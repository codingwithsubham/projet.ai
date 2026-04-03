const marketplaceService = require("../services/marketplace.service");

module.exports = {
  syncMarketplace: async () => {
    await marketplaceService.syncAgentsFromRegistry();
  },
};
