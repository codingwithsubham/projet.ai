const mongoose = require("mongoose");
const { AGENT_CATEGORIES, AGENT_STATUS } = require("../common/agent-registry");

const agentSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: '🤖'
    },
    category: {
      type: String,
      enum: Object.values(AGENT_CATEGORIES),
      default: AGENT_CATEGORIES.COMMON
    },
    route: {
      type: String,
      required: true
    },
    sidebarLabel: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(AGENT_STATUS),
      default: AGENT_STATUS.ACTIVE
    },
    version: {
      type: String,
      default: '1.0.0'
    },
    features: {
      type: [String],
      default: []
    },
    // Metadata for analytics
    subscriberCount: {
      type: Number,
      default: 0
    },
    // Allow runtime overrides from admin
    isOverridden: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Index for common queries
agentSchema.index({ status: 1, category: 1 });

const AgentModel = mongoose.model("Agent", agentSchema);

module.exports = AgentModel;
