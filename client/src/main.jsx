import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import App from "./App.jsx";
import {AuthProvider} from "./context/AuthContext.jsx";
import {WialonProvider} from "./context/WialonProvider.jsx";
import "./index.scss";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WialonProvider>
          <App />
        </WialonProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
