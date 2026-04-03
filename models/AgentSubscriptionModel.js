const mongoose = require("mongoose");

const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  UNSUBSCRIBED: 'unsubscribed'
};

const SUBSCRIPTION_ACTIONS = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe'
};

const historyEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: Object.values(SUBSCRIPTION_ACTIONS),
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const agentSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    agentSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.ACTIVE
    },
    subscribedAt: {
      type: Date,
      default: Date.now
    },
    unsubscribedAt: {
      type: Date,
      default: null
    },
    // Append-only history for audit trail
    history: {
      type: [historyEntrySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient lookups
agentSubscriptionSchema.index({ userId: 1, agentSlug: 1 }, { unique: true });
agentSubscriptionSchema.index({ userId: 1, status: 1 });

/**
 * Static method to check if user is subscribed to an agent
 */
agentSubscriptionSchema.statics.isSubscribed = async function(userId, agentSlug) {
  const subscription = await this.findOne({
    userId,
    agentSlug,
    status: SUBSCRIPTION_STATUS.ACTIVE
  });
  return !!subscription;
};

/**
 * Static method to get all active subscriptions for a user
 */
agentSubscriptionSchema.statics.getUserActiveSubscriptions = async function(userId) {
  return this.find({
    userId,
    status: SUBSCRIPTION_STATUS.ACTIVE
  }).sort({ subscribedAt: -1 });
};

const AgentSubscriptionModel = mongoose.model("AgentSubscription", agentSubscriptionSchema);

module.exports = {
  AgentSubscriptionModel,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_ACTIONS
};
