import React, { useState } from "react";

const SlideViewer = ({ slides = [], currentSlideIndex = 0 }) => {
  const [activeSlide, setActiveSlide] = useState(currentSlideIndex);

  if (!slides || slides.length === 0) {
    return (
      <div className="slide-viewer empty">
        <div className="empty-state">
          <p>No slides available</p>
        </div>
      </div>
    );
  }

  const currentSlide = slides[activeSlide];

  const goToNextSlide = () => {
    if (activeSlide < slides.length - 1) {
      setActiveSlide(activeSlide + 1);
    }
  };

  const goToPreviousSlide = () => {
    if (activeSlide > 0) {
      setActiveSlide(activeSlide - 1);
    }
  };

  const goToSlide = (index) => {
    setActiveSlide(index);
  };

  return (
    <div className="slide-viewer">
      {/* Slide Display */}
      <div className="slide-display">
        <div className="slide-display-wrapper">
          {currentSlide?.content ? (
            <iframe
              srcDoc={currentSlide.content}
              title={currentSlide.slideName || `Slide ${activeSlide + 1}`}
              frameBorder="0"
              className="slide-iframe"
            />
          ) : (
            <div className="slide-placeholder">
              <p>Unable to load slide content</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="slide-controls">
        <button
          onClick={goToPreviousSlide}
          disabled={activeSlide === 0}
          className="btn btn-sm btn-secondary"
        >
          ← Previous
        </button>

        <div className="slide-counter">
          Slide {activeSlide + 1} of {slides.length}
        </div>

        <button
          onClick={goToNextSlide}
          disabled={activeSlide === slides.length - 1}
          className="btn btn-sm btn-secondary"
        >
          Next →
        </button>
      </div>

      {/* Slide Thumbnails */}
      <div className="slide-thumbnails">
        <div className="thumbnails-scroll">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`thumbnail ${index === activeSlide ? "active" : ""}`}
              onClick={() => goToSlide(index)}
              title={slide.slideName || `Slide ${index + 1}`}
            >
              <div className="thumbnail-number">{index + 1}</div>
              <div className="thumbnail-title">{slide.slideName || `Slide ${index + 1}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SlideViewer;
