const mongoose = require("mongoose");
const { USER_ROLES } = require("../common/user-roles");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, unique: true, lowercase: true },
    email: { type: String, required: true, trim: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, required: true, trim: true, enum: USER_ROLES },
    name: { type: String, required: true, trim: true },
    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
      },
    ],
  },
  {
    timestamps: true,
    collection: "users",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("User", UserSchema);