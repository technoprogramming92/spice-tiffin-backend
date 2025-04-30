// src/services/customer.service.ts (Create or update)
import { Customer, ICustomer } from "../models/Customer.model.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Use bcryptjs if that's what auth.service uses

// Consistent salt rounds (consider putting in config)
const SALT_ROUNDS = 10;

export class CustomerService {
  /** Find customer by phone number, selecting reset token fields */
  async findByPhoneNumber(phoneNumber: string): Promise<ICustomer | null> {
    console.log(`[CustomerService] Finding user by phone: ${phoneNumber}`);
    // Normalize phoneNumber if necessary before query
    return Customer.findOne({ mobile: phoneNumber }).select(
      "+password +passwordResetTokenHash +passwordResetTokenExpires"
    ); // Also select password for login/reset checks
  }

  /** Sets final password reset token hash and expiry. DOES NOT SAVE. */
  setFinalResetTokenFields(
    user: ICustomer,
    tokenHash: string,
    expires: Date
  ): void {
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetTokenExpires = expires;
  }

  /** Updates the user's password and clears reset fields */
  async updatePassword(
    userId: string,
    newPasswordClear: string
  ): Promise<void> {
    // Fetching user again ensures we have the latest version, though findByPasswordResetToken could return it
    const user = await Customer.findById(userId).select(
      "+password +passwordResetTokenHash +passwordResetTokenExpires"
    );
    if (!user) {
      throw new Error("User not found for password update.");
    }
    console.log(`[CustomerService] Updating password for user ${userId}`);

    // Hash the new password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    user.password = await bcrypt.hash(newPasswordClear, salt);

    // Clear reset token fields
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpires = null;

    await user.save();
    console.log(
      `[CustomerService] Password updated successfully for user ${userId}`
    );
  }

  // Add other methods like findById if needed elsewhere
}

// Export an instance (matches pattern in auth.service)
export const customerService = new CustomerService();
