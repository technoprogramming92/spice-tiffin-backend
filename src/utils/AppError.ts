/**
 * @class AppError
 * @extends Error
 * @description Custom error class for operational errors with a status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;

  /**
   * Creates an instance of AppError.
   * @param {string} message - The error message.
   * @param {number} statusCode - The HTTP status code associated with this error.
   */
  constructor(message: string, statusCode: number) {
    super(message); // Call the parent constructor (Error)

    this.statusCode = statusCode;
    // Determine status based on statusCode (e.g., 4xx -> 'fail', 5xx -> 'error')
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    // Mark as an operational error (errors we expect and handle gracefully)
    this.isOperational = true;

    // Capture the stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for TypeScript when extending built-in classes
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
