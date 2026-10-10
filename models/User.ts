import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [1, "Name cannot be empty"],
      maxlength: [80, "Name must be 80 characters or fewer"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [254, "Email must be 254 characters or fewer"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false,
      minlength: [1, "Password hash cannot be empty"],
    },
  },
  { timestamps: true, versionKey: false },
);

// Enforce uniqueness in MongoDB as well as normalizing email in the schema.
userSchema.index({ email: 1 }, { unique: true, name: "user_email_unique" });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>("User", userSchema);
