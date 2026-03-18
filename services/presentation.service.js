const Presentation = require("../models/PresentationModel");
const Slide = require("../models/SlideModel");
const User = require("../models/UserModel");

const isPmUser = (user) => String(user?.role || "") === "PM";

const createPresentation = async (payload) => {
  const presentation = await Presentation.create(payload);
  return presentation;
};

const getAllPresentations = async (user) => {
  if (!user) return [];

  // Only PM users and admins can access presentations
  if (String(user.role) !== "PM" && String(user.role) !== "admin") {
    return [];
  }

  if (String(user.role) === "admin") {
    return await Presentation.find()
      .populate("createdBy", "name email")
      .populate("slides")
      .sort({ createdAt: -1 });
  }

  return await Presentation.find({ createdBy: user.id })
    .populate("slides")
    .sort({ createdAt: -1 });
};

const getPresentationById = async (id, user) => {
  const presentation = await Presentation.findById(id)
    .populate("createdBy", "name email")
    .populate("slides");

  if (!presentation) return null;

  // Check access: only creator, admins, or PM can view
  if (
    String(user.id) !== String(presentation.createdBy._id) &&
    String(user.role) !== "admin"
  ) {
    return null;
  }

  return presentation;
};

const updatePresentationStatus = async (id, status, errorMessage = "") => {
  const updateData = { status };
  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  return await Presentation.findByIdAndUpdate(id, updateData, { new: true });
};

/**
 * Update presentation progress message
 * @param {string} id - Presentation ID
 * @param {string} statusMessage - Progress message (e.g., "Generating Slide 2")
 */
const updatePresentationProgress = async (id, statusMessage) => {
  return await Presentation.findByIdAndUpdate(
    id,
    { statusMessage },
    { new: true }
  );
};

/**
 * Add a single slide to presentation
 * @param {string} presentationId - Presentation ID
 * @param {object} slideData - Slide data object
 */
const addSlideToPresentation = async (presentationId, slideData) => {
  const newSlide = await Slide.create(slideData);
  
  await Presentation.findByIdAndUpdate(
    presentationId,
    { $push: { slides: newSlide._id } },
    { new: true }
  );

  return newSlide;
};

/**
 * Mark presentation as completed
 * @param {string} id - Presentation ID
 * @param {number} generationTime - Total generation time in ms
 */
const completePresentationGeneration = async (id, generationTime = 0) => {
  return await Presentation.findByIdAndUpdate(
    id,
    { 
      status: "completed", 
      statusMessage: "Generation completed",
      generationTime 
    },
    { new: true }
  ).populate("slides");
};

const addSlidesToPresentation = async (presentationId, slides) => {
  const slideIds = [];

  for (const slide of slides) {
    const newSlide = await Slide.create(slide);
    slideIds.push(newSlide._id);
  }

  const presentation = await Presentation.findByIdAndUpdate(
    presentationId,
    { slides: slideIds, status: "completed" },
    { new: true }
  ).populate("slides");

  return presentation;
};

const searchPresentations = async (user, searchTerm, filters = {}) => {
  if (!user || (String(user.role) !== "PM" && String(user.role) !== "admin")) {
    return [];
  }

  const query = {};

  // Add role-based filtering
  if (String(user.role) !== "admin") {
    query.createdBy = user._id;
  }

  // Add search term
  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
    ];
  }

  // Add date filter if provided
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }

  return await Presentation.find(query)
    .populate("createdBy", "name email")
    .populate("slides")
    .sort({ createdAt: -1 });
};

const deletePresentationById = async (id, user) => {
  const presentation = await Presentation.findById(id);

  if (!presentation) {
    return { success: false, message: "Presentation not found" };
  }

  // Check access
  if (
    String(user.id) !== String(presentation.createdBy) &&
    String(user.role) !== "admin"
  ) {
    return { success: false, message: "Unauthorized to delete this presentation" };
  }

  // Delete all associated slides
  if (presentation.slides && presentation.slides.length > 0) {
    await Slide.deleteMany({ _id: { $in: presentation.slides } });
  }

  await Presentation.findByIdAndDelete(id);
  return { success: true, message: "Presentation deleted successfully" };
};

module.exports = {
  createPresentation,
  getAllPresentations,
  getPresentationById,
  updatePresentationStatus,
  updatePresentationProgress,
  addSlideToPresentation,
  completePresentationGeneration,
  addSlidesToPresentation,
  searchPresentations,
  deletePresentationById,
  isPmUser,
};
