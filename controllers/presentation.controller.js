const mongoose = require("mongoose");
const presentationService = require("../services/presentation.service");
const projectService = require("../services/project.service");
const { processPresentationWithAgent } = require("../z-agents/pptAgent");

const createPresentation = async (req, res) => {
  try {
    const { name, numberOfPages, prompt, projectId, description, contentProvided, providedContent } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || !numberOfPages || !prompt || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, numberOfPages, prompt, projectId",
      });
    }

    // If contentProvided mode, providedContent is required
    if (contentProvided && !providedContent) {
      return res.status(400).json({
        success: false,
        message: "providedContent is required when contentProvided is true",
      });
    }

    if (numberOfPages < 1 || numberOfPages > 5) {
      return res.status(400).json({
        success: false,
        message: "Number of pages must be between 1 and 5",
      });
    }

    // Check if user is PM or admin
    if (String(req.user.role) !== "PM" && String(req.user.role) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only PM users can create presentations",
      });
    }

    // Get project if provided
    let project = null;
    if (projectId) {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }
      project = await projectService.getProjectById(projectId, req.user);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }
    }

    // Create presentation in draft status
    const presentation = await presentationService.createPresentation({
      name,
      prompt,
      numberOfPages: parseInt(numberOfPages),
      description: description || "",
      createdBy: userId,
      projectId: projectId || null,
      status: "draft",
      statusMessage: "Generating 1st Slide",
    });

    // Start background generation
    // If contentProvided=true, pass delegated mode to skip RAG
    processPresentationWithAgent({
      presentationId: presentation._id,
      name,
      prompt,
      numberOfPages: parseInt(numberOfPages),
      projectId: projectId || null,
      project,
      delegated: !!contentProvided,
      delegatedContent: providedContent || "",
    }).catch((error) => {
      console.error(`❌ Presentation ${presentation._id} error:`, error.message);
    });

    // Return immediately
    return res.status(200).json({
      success: true,
      message: "Generating",
      data: {
        presentationId: presentation._id,
        name: presentation.name,
        status: presentation.status,
        statusMessage: presentation.statusMessage,
      },
    });
  } catch (error) {
    console.error("Create presentation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create presentation",
      error: error.message,
    });
  }
};

const getAllPresentations = async (req, res) => {
  try {
    const presentations = await presentationService.getAllPresentations(
      req.user
    );

    return res.status(200).json({
      success: true,
      data: presentations,
    });
  } catch (error) {
    console.error("Get presentations error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch presentations",
      error: error.message,
    });
  }
};

const getPresentationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid presentation ID",
      });
    }

    const presentation = await presentationService.getPresentationById(
      id,
      req.user
    );

    if (!presentation) {
      return res.status(404).json({
        success: false,
        message: "Presentation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: presentation,
    });
  } catch (error) {
    console.error("Get presentation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch presentation",
      error: error.message,
    });
  }
};

const searchPresentations = async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;

    const presentations = await presentationService.searchPresentations(
      req.user,
      search || "",
      {
        startDate,
        endDate,
      }
    );

    return res.status(200).json({
      success: true,
      data: presentations,
    });
  } catch (error) {
    console.error("Search presentations error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search presentations",
      error: error.message,
    });
  }
};

const deletePresentation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid presentation ID",
      });
    }

    const result = await presentationService.deletePresentationById(
      id,
      req.user
    );

    if (!result.success) {
      return res.status(403).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Presentation deleted successfully",
    });
  } catch (error) {
    console.error("Delete presentation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete presentation",
      error: error.message,
    });
  }
};

const downloadPPTX = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid presentation ID",
      });
    }

    const presentation = await presentationService.getPresentationById(
      id,
      req.user
    );

    if (!presentation) {
      return res.status(404).json({
        success: false,
        message: "Presentation not found",
      });
    }

    if (!presentation.slides || presentation.slides.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Presentation has no slides",
      });
    }

    const pptxBuffer = await presentationService.generatePPTX(presentation);
    const fileName = `${presentation.name.replace(/[^a-zA-Z0-9]/g, "_")}.pptx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pptxBuffer.length);

    return res.send(pptxBuffer);
  } catch (error) {
    console.error("Download PPTX error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate PPTX",
      error: error.message,
    });
  }
};

module.exports = {
  createPresentation,
  getAllPresentations,
  getPresentationById,
  searchPresentations,
  deletePresentation,
  downloadPPTX,
};
