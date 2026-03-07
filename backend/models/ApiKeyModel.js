const mongoose = require("mongoose");
const { USER_ROLES } = require("../common/user-roles");

const ApiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    keyPreview: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true, enum: USER_ROLES, default: "dev" },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "api_keys",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.keyHash;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.keyHash;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("ApiKey", ApiKeySchema);