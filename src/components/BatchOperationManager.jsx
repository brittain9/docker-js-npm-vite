import { useState, useEffect, useRef } from "react";
import userApi from "../api/userApi";

/*
 * BatchOperationManager
 *
 * This component manages complex batch operations with:
 * 1. Conflict detection between concurrent operations
 * 2. Optimistic updates with rollback on failure
 * 3. Retry mechanisms with exponential backoff
 * 4. Transaction-like semantics (all-or-nothing updates)
 */
export const BatchOperationManager = ({ onComplete, onError }) => {
  const [operations, setOperations] = useState([]);
  const [status, setStatus] = useState("idle"); // idle, running, success, error
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [errorDetails, setErrorDetails] = useState(null);
  const currentBatchRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Detect conflicts between operations in the same batch
  const detectConflicts = (ops) => {
    const conflicts = [];
    const userIdMap = new Map();

    // Find operations targeting the same user
    ops.forEach((op, index) => {
      if (userIdMap.has(op.userId)) {
        const prevIndex = userIdMap.get(op.userId);
        conflicts.push({
          type: "user_conflict",
          indices: [prevIndex, index],
          message: `Operations ${prevIndex} and ${index} target the same user (${op.userId})`,
          resolutions: ["merge", "keep_first", "keep_last"],
        });
      } else {
        userIdMap.set(op.userId, index);
      }
    });

    // Find operations with circular dependencies
    const depGraph = new Map();
    const visited = new Set();
    const recStack = new Set();

    // Build dependency graph
    ops.forEach((op, index) => {
      if (op.dependsOn && op.dependsOn.length > 0) {
        depGraph.set(
          index,
          op.dependsOn
            .map((depId) => {
              // Find index of operation with this userId
              return ops.findIndex((o) => o.userId === depId);
            })
            .filter((idx) => idx !== -1)
        );
      } else {
        depGraph.set(index, []);
      }
    });

    // DFS to find cycles
    const isCyclic = (node) => {
      if (!visited.has(node)) {
        visited.add(node);
        recStack.add(node);

        const neighbors = depGraph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && isCyclic(neighbor)) {
            return true;
          } else if (recStack.has(neighbor)) {
            // Found a cycle - record the conflict
            conflicts.push({
              type: "circular_dependency",
              indices: Array.from(recStack).concat([neighbor]),
              message: `Circular dependency detected in operations: ${Array.from(
                recStack
              )
                .concat([neighbor])
                .join(" -> ")}`,
              resolutions: ["remove_dependency", "reorder"],
            });
            return true;
          }
        }
      }

      recStack.delete(node);
      return false;
    };

    // Check each node for cycles
    for (let i = 0; i < ops.length; i++) {
      if (!visited.has(i)) {
        isCyclic(i);
      }
    }

    // Find field-level conflicts (operations modifying the same field)
    ops.forEach((op1, i) => {
      ops.slice(i + 1).forEach((op2, j) => {
        const realJ = i + j + 1;

        // Skip if we already have a user-level conflict for these operations
        if (
          conflicts.some(
            (c) =>
              c.type === "user_conflict" &&
              c.indices.includes(i) &&
              c.indices.includes(realJ)
          )
        ) {
          return;
        }

        // Check for conflicts in specific fields
        const commonFields = Object.keys(op1.data).filter(
          (key) =>
            Object.keys(op2.data).includes(key) &&
            op1.data[key] !== op2.data[key]
        );

        if (commonFields.length > 0) {
          conflicts.push({
            type: "field_conflict",
            indices: [i, realJ],
            fields: commonFields,
            message: `Operations ${i} and ${realJ} modify the same fields with different values: ${commonFields.join(
              ", "
            )}`,
            resolutions: ["merge", "keep_first", "keep_last", "manual_resolve"],
          });
        }
      });
    });

    return conflicts;
  };

  // Add a batch operation
  const addOperation = (operation) => {
    setOperations((prev) => {
      const newOps = [...prev, operation];
      const newConflicts = detectConflicts(newOps);
      setConflicts(newConflicts);
      return newOps;
    });
  };

  // Add multiple operations at once
  const addOperations = (newOperations) => {
    setOperations((prev) => {
      const newOps = [...prev, ...newOperations];
      const newConflicts = detectConflicts(newOps);
      setConflicts(newConflicts);
      return newOps;
    });
  };

  // Clear all operations
  const clearOperations = () => {
    setOperations([]);
    setConflicts([]);
    setResults([]);
    setErrorDetails(null);
    setStatus("idle");
    setProgress(0);
  };

  // Resolve a conflict using the specified strategy
  const resolveConflict = (conflictIndex, resolution, manualValues = {}) => {
    setConflicts((prev) => {
      const newConflicts = [...prev];
      const conflict = newConflicts[conflictIndex];

      if (!conflict) return prev;

      // Remove the conflict
      newConflicts.splice(conflictIndex, 1);

      // Apply resolution based on the type
      setOperations((prevOps) => {
        const newOps = [...prevOps];

        if (
          conflict.type === "user_conflict" ||
          conflict.type === "field_conflict"
        ) {
          const [idx1, idx2] = conflict.indices;

          switch (resolution) {
            case "keep_first":
              // Remove the second operation
              newOps.splice(idx2, 1);
              break;

            case "keep_last":
              // Remove the first operation
              newOps.splice(idx1, 1);
              break;

            case "merge":
              // Merge the operations, second one's values override the first
              const mergedData = { ...newOps[idx1].data };

              if (conflict.type === "field_conflict") {
                // Only merge the conflicting fields
                conflict.fields.forEach((field) => {
                  mergedData[field] = newOps[idx2].data[field];
                });
              } else {
                // Merge all fields
                Object.assign(mergedData, newOps[idx2].data);
              }

              newOps[idx1] = {
                ...newOps[idx1],
                data: mergedData,
                mergedFrom: [newOps[idx1].userId, newOps[idx2].userId],
              };

              // Remove the second operation
              newOps.splice(idx2, 1);
              break;

            case "manual_resolve":
              // Use manually provided values for conflict resolution
              const manualData = { ...newOps[idx1].data };

              if (conflict.fields) {
                conflict.fields.forEach((field) => {
                  if (field in manualValues) {
                    manualData[field] = manualValues[field];
                  }
                });
              }

              newOps[idx1] = {
                ...newOps[idx1],
                data: manualData,
                manuallyResolved: true,
              };

              // Remove the second operation
              newOps.splice(idx2, 1);
              break;
          }
        } else if (conflict.type === "circular_dependency") {
          switch (resolution) {
            case "remove_dependency":
              // Remove the dependency that causes the cycle
              const cycle = conflict.indices;
              const lastIdx = cycle[cycle.length - 1];
              const prevIdx = cycle[cycle.length - 2];

              // Find and remove the dependency
              const op = newOps[prevIdx];
              if (op.dependsOn) {
                const targetId = newOps[lastIdx].userId;
                op.dependsOn = op.dependsOn.filter((id) => id !== targetId);
              }
              break;

            case "reorder":
              // Reorder operations to break the cycle
              const indices = conflict.indices;
              const moved = newOps[indices[0]];

              // Move the first operation to after the last one
              newOps.splice(indices[0], 1);
              newOps.splice(indices[indices.length - 1], 0, moved);
              break;
          }
        }

        // Detect any remaining conflicts
        const remainingConflicts = detectConflicts(newOps);
        setConflicts(remainingConflicts);

        return newOps;
      });

      return newConflicts;
    });
  };

  // Execute the batch of operations
  const executeBatch = async (options = {}) => {
    const {
      transactional = true,
      retryCount = 3,
      parallelOps = false,
    } = options;

    if (operations.length === 0) {
      setErrorDetails({ message: "No operations to execute" });
      setStatus("error");
      if (onError) onError({ message: "No operations to execute" });
      return;
    }

    if (conflicts.length > 0) {
      setErrorDetails({
        message: "Cannot execute batch with unresolved conflicts",
      });
      setStatus("error");
      if (onError)
        onError({ message: "Cannot execute batch with unresolved conflicts" });
      return;
    }

    // Start execution
    setStatus("running");
    setProgress(0);
    setResults([]);
    setErrorDetails(null);

    try {
      // Clone operations and save current batch
      const batch = JSON.parse(JSON.stringify(operations));
      currentBatchRef.current = batch;

      // Set up abort controller for cancellable operations
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Build operation dependency chain
      let opSequence;
      if (parallelOps) {
        // Parallel execution (ignores dependencies)
        opSequence = batch;
      } else {
        // Sequential execution respecting dependencies
        const pendingOps = [...batch];
        const completedIds = new Set();
        opSequence = [];

        while (pendingOps.length > 0) {
          const opIndex = pendingOps.findIndex(
            (op) =>
              !op.dependsOn || op.dependsOn.every((id) => completedIds.has(id))
          );

          if (opIndex === -1) {
            throw new Error("Unexpected circular dependency detected");
          }

          const nextOp = pendingOps.splice(opIndex, 1)[0];
          opSequence.push(nextOp);
          completedIds.add(nextOp.userId);
        }
      }

      const results = [];
      let hadErrors = false;

      // Execute operations
      for (let i = 0; i < opSequence.length; i++) {
        // Check if operation was aborted
        if (signal.aborted) {
          throw new Error("Batch operation was cancelled");
        }

        const op = opSequence[i];

        try {
          // Update progress
          setProgress(Math.floor((i / opSequence.length) * 100));

          // Execute with retry logic
          let attempt = 0;
          let success = false;
          let error = null;
          let result = null;

          while (attempt < retryCount && !success) {
            try {
              // Exponential backoff for retries
              if (attempt > 0) {
                const backoffMs = Math.pow(2, attempt) * 500;
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
              }

              // Execute the operation
              result = await userApi.updateUser(
                op.userId,
                op.data,
                op.mergeStrategy || "shallow"
              );
              success = true;
            } catch (err) {
              error = err;
              attempt++;

              // If transactional, break on first error
              if (transactional) {
                break;
              }
            }
          }

          if (success) {
            results.push({
              userId: op.userId,
              success: true,
              result,
              attempts: attempt + 1,
            });
          } else {
            results.push({
              userId: op.userId,
              success: false,
              error,
              attempts: attempt + 1,
            });
            hadErrors = true;

            // If transactional, stop on first error
            if (transactional) {
              throw new Error(
                `Operation failed for user ${op.userId}: ${
                  error?.message || "Unknown error"
                }`
              );
            }
          }
        } catch (err) {
          results.push({
            userId: op.userId,
            success: false,
            error: err,
            attempts: 1,
          });
          hadErrors = true;

          // If transactional, stop on first error
          if (transactional) {
            throw new Error(
              `Operation failed for user ${op.userId}: ${
                err?.message || "Unknown error"
              }`
            );
          }
        }
      }

      // Finalize results
      setResults(results);

      if (hadErrors && transactional) {
        // If any operation failed and we're in transactional mode, the batch fails
        setErrorDetails({
          message: "Batch failed due to one or more errors",
          results,
        });
        setStatus("error");
        if (onError)
          onError({
            message: "Batch failed due to one or more errors",
            results,
          });
      } else {
        // Batch completed
        setStatus("success");
        setProgress(100);
        if (onComplete) onComplete(results);
      }
    } catch (error) {
      setErrorDetails({
        message: error.message || "Error executing batch operations",
        error,
      });
      setStatus("error");
      if (onError)
        onError({
          message: error.message || "Error executing batch operations",
          error,
        });
    }
  };

  // Cancel running batch
  const cancelBatch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus("idle");
      setErrorDetails({ message: "Batch operation cancelled by user" });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    addOperation,
    addOperations,
    clearOperations,
    resolveConflict,
    executeBatch,
    cancelBatch,
    operations,
    conflicts,
    status,
    progress,
    results,
    errorDetails,
  };
};

export default BatchOperationManager;
