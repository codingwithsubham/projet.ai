import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AppDataProvider } from "./context/AppDataContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppDataProvider>
      <SubscriptionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SubscriptionProvider>
    </AppDataProvider>
  </React.StrictMode>
);