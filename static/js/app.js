// Double Pendulum Physics Simulation - Client Side Logic with React-like State Management

// React-like State Management System
class StateManager {
  constructor(initialState) {
    this.state = initialState;
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(newState, source = "unknown") {
    const prevState = this.state;
    this.state = { ...this.state, ...newState };
    this.notifyListeners(prevState, this.state, source);
  }

  updateState(path, value) {
    const keys = path.split(".");
    const newState = { ...this.state };
    let current = newState;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    this.setState(newState, `update:${path}`);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(prevState, newState, source) {
    this.listeners.forEach((listener) => {
      try {
        listener(prevState, newState, source);
      } catch (error) {
        console.error("State listener error:", error);
      }
    });
  }
}

// Global state with default values
const stateManager = new StateManager({
  isPaused: false,
  showTrails: true,
  initialEnergy: null,
  fps: 0,
  frameCount: 0,
  isConnected: false,
  connectionRetries: 0,
  updateTimeouts: {},

  // Simulation data
  latestCoords: null,
  latestEnergy: null,
  simulationState: null,

  // Physical parameters
  parameters: {
    length_rod_1: 120,
    length_rod_2: 120,
    mass_bob_1: 10,
    mass_bob_2: 10,
    g: 9.81,
  },

  // Initial conditions
  conditions: {
    theta_1: 1.57,
    theta_2: 1.57,
    omega_1: 0.0,
    omega_2: 0.0,
  },
});

const maxRetries = 5;
const MAX_TRAIL = 300;

// Trail data
const trail1 = [];
const trail2 = [];

// DOM elements
const canvas = document.getElementById("pendulum-canvas");
const ctx = canvas.getContext("2d");
const ORIGIN_X = Number(canvas.getAttribute("data-origin-x")) || 300;
const ORIGIN_Y = Number(canvas.getAttribute("data-origin-y")) || 100;
const statusIndicator = document.getElementById("connection-status");
const statusText = document.getElementById("status-text");

// State change listener for UI updates
stateManager.subscribe((prevState, newState, source) => {
  if (source !== "local_update") {
    // Only update UI if the change came from server or other sources
    updateAllDisplays();
  }
});

// Initialize the simulation
document.addEventListener("DOMContentLoaded", function () {
  // Start polling and animation
  setInterval(pollState, 50);
  requestAnimationFrame(animate);
});

// Canvas drawing functions
function drawPendulum(coords) {
  if (!coords) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw pivot point
  ctx.beginPath();
  ctx.arc(ORIGIN_X, ORIGIN_Y, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#444";
  ctx.fill();

  // Draw rods connecting the bobs
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  ctx.lineTo(coords[0].x, coords[0].y);
  ctx.lineTo(coords[1].x, coords[1].y);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw pendulum bobs
  for (let i = 0; i < coords.length; i++) {
    ctx.beginPath();
    ctx.arc(coords[i].x, coords[i].y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = i === 0 ? "#1976d2" : "#ef6c00";
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Add number labels to bobs
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((i + 1).toString(), coords[i].x, coords[i].y);
  }
}

function drawTrail(trail, color) {
  if (trail.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(trail[0].x, trail[0].y);
  for (let i = 1; i < trail.length; i++) {
    ctx.lineTo(trail[i].x, trail[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

// Data polling functions
async function pollState() {
  try {
    const response = await fetch("/state", { cache: "no-store" });
    if (response.ok) {
      const state = await response.json();
      const currentState = stateManager.getState();

      // Update state manager with full state sync
      stateManager.setState(
        {
          latestCoords: state.coords,
          latestEnergy: state.energy,
          simulationState: state,
          parameters: {
            length_rod_1: state.length_rod_1,
            length_rod_2: state.length_rod_2,
            mass_bob_1: state.mass_bob_1,
            mass_bob_2: state.mass_bob_2,
            g: state.g,
          },
          conditions: {
            theta_1: state.theta_1,
            theta_2: state.theta_2,
            omega_1: state.omega_1,
            omega_2: state.omega_2,
          },
        },
        "server_update"
      );

      // Update connection status
      if (!currentState.isConnected) {
        stateManager.setState(
          {
            isConnected: true,
            connectionRetries: 0,
          },
          "connection_recovered"
        );
      }
    } else {
      handleConnectionError();
    }
  } catch (e) {
    handleConnectionError();
  }
}

// UI update functions
function updateAllDisplays() {
  const state = stateManager.getState();

  // Update energy display
  if (state.latestEnergy) {
    updateEnergyDisplay();
  }

  // Update angular display
  if (state.simulationState) {
    updateAngularDisplay(state.simulationState);
  }

  // Update parameter displays
  updateParameterDisplays();

  // Update slider inputs to match server state
  updateSliderInputs();

  // Update connection status
  updateConnectionStatus(state.isConnected);
}

function updateEnergyDisplay() {
  const state = stateManager.getState();
  if (!state.latestEnergy) return;

  // Update energy displays with null checks
  const kineticEl = document.getElementById("kinetic-energy");
  const potentialEl = document.getElementById("potential-energy");
  const totalEl = document.getElementById("total-energy");
  const errorEl = document.getElementById("energy-error");

  if (kineticEl) kineticEl.textContent = state.latestEnergy.kinetic.toFixed(2);
  if (potentialEl)
    potentialEl.textContent = state.latestEnergy.potential.toFixed(2);
  if (totalEl) totalEl.textContent = state.latestEnergy.total.toFixed(2);

  // Calculate energy conservation error
  if (state.initialEnergy === null) {
    stateManager.setState(
      { initialEnergy: state.latestEnergy.total },
      "energy_init"
    );
  }
  const conservationError = Math.abs(
    ((state.latestEnergy.total - state.initialEnergy) / state.initialEnergy) *
      100
  );
  if (errorEl) {
    errorEl.textContent = conservationError.toFixed(2) + "%";
    // Color code the conservation error
    if (conservationError < 0.1) {
      errorEl.style.color = "#4caf50";
    } else if (conservationError < 1.0) {
      errorEl.style.color = "#ff9800";
    } else {
      errorEl.style.color = "#f44336";
    }
  }
}

function updateAngularDisplay(simulationState) {
  const state = stateManager.getState();

  // Always use the most recent values from simulationState (server) or fallback to conditions
  const theta1 = simulationState?.theta_1 ?? state.conditions.theta_1;
  const theta2 = simulationState?.theta_2 ?? state.conditions.theta_2;
  const omega1 = simulationState?.omega_1 ?? state.conditions.omega_1;
  const omega2 = simulationState?.omega_2 ?? state.conditions.omega_2;

  // Update Angular Motion display values (these are the main display elements)
  const theta1El = document.getElementById("theta-1");
  const theta2El = document.getElementById("theta-2");
  const omega1El = document.getElementById("omega-1");
  const omega2El = document.getElementById("omega-2");

  if (theta1El && theta1El.textContent !== (theta1 || 0).toFixed(2)) {
    theta1El.textContent = (theta1 || 0).toFixed(2);
  }
  if (theta2El && theta2El.textContent !== (theta2 || 0).toFixed(2)) {
    theta2El.textContent = (theta2 || 0).toFixed(2);
  }
  if (omega1El && omega1El.textContent !== (omega1 || 0).toFixed(2)) {
    omega1El.textContent = (omega1 || 0).toFixed(2);
  }
  if (omega2El && omega2El.textContent !== (omega2 || 0).toFixed(2)) {
    omega2El.textContent = (omega2 || 0).toFixed(2);
  }

  // Update Initial Conditions display values (theta-1-display, theta-2-display, omega-1-display, omega-2-display)
  const theta1DisplayEl = document.getElementById("theta-1-display");
  const theta2DisplayEl = document.getElementById("theta-2-display");
  const omega1DisplayEl = document.getElementById("omega-1-display");
  const omega2DisplayEl = document.getElementById("omega-2-display");

  if (
    theta1DisplayEl &&
    theta1DisplayEl.textContent !== (theta1 || 0).toFixed(1)
  ) {
    theta1DisplayEl.textContent = (theta1 || 0).toFixed(1);
  }
  if (
    theta2DisplayEl &&
    theta2DisplayEl.textContent !== (theta2 || 0).toFixed(1)
  ) {
    theta2DisplayEl.textContent = (theta2 || 0).toFixed(1);
  }
  if (
    omega1DisplayEl &&
    omega1DisplayEl.textContent !== (omega1 || 0).toFixed(1)
  ) {
    omega1DisplayEl.textContent = (omega1 || 0).toFixed(1);
  }
  if (
    omega2DisplayEl &&
    omega2DisplayEl.textContent !== (omega2 || 0).toFixed(1)
  ) {
    omega2DisplayEl.textContent = (omega2 || 0).toFixed(1);
  }
}

function updateParameterDisplays() {
  const state = stateManager.getState();

  // Update parameter display values with correct IDs
  const length1El = document.getElementById("length-1");
  const length2El = document.getElementById("length-2");
  const mass1El = document.getElementById("mass-1");
  const mass2El = document.getElementById("mass-2");
  const gravityEl = document.getElementById("gravity");

  if (length1El)
    length1El.textContent = state.parameters.length_rod_1.toFixed(0);
  if (length2El)
    length2El.textContent = state.parameters.length_rod_2.toFixed(0);
  if (mass1El) mass1El.textContent = state.parameters.mass_bob_1.toFixed(0);
  if (mass2El) mass2El.textContent = state.parameters.mass_bob_2.toFixed(0);
  if (gravityEl) gravityEl.textContent = state.parameters.g.toFixed(1);
}

function updateSliderInputs() {
  const state = stateManager.getState();

  // Update parameter slider input values to match server state
  const length1Input = document.getElementById("length-1-input");
  const length2Input = document.getElementById("length-2-input");
  const mass1Input = document.getElementById("mass-1-input");
  const mass2Input = document.getElementById("mass-2-input");
  const gravityInput = document.getElementById("gravity-input");

  if (
    length1Input &&
    Number(length1Input.value) !== state.parameters.length_rod_1
  ) {
    length1Input.value = state.parameters.length_rod_1;
  }
  if (
    length2Input &&
    Number(length2Input.value) !== state.parameters.length_rod_2
  ) {
    length2Input.value = state.parameters.length_rod_2;
  }
  if (mass1Input && Number(mass1Input.value) !== state.parameters.mass_bob_1) {
    mass1Input.value = state.parameters.mass_bob_1;
  }
  if (mass2Input && Number(mass2Input.value) !== state.parameters.mass_bob_2) {
    mass2Input.value = state.parameters.mass_bob_2;
  }
  if (gravityInput && Number(gravityInput.value) !== state.parameters.g) {
    gravityInput.value = state.parameters.g;
  }

  // Also update condition sliders
  const theta1Input = document.getElementById("theta-1-input");
  const theta2Input = document.getElementById("theta-2-input");
  const omega1Input = document.getElementById("omega-1-input");
  const omega2Input = document.getElementById("omega-2-input");

  if (theta1Input && Number(theta1Input.value) !== state.conditions.theta_1) {
    theta1Input.value = state.conditions.theta_1;
  }
  if (theta2Input && Number(theta2Input.value) !== state.conditions.theta_2) {
    theta2Input.value = state.conditions.theta_2;
  }
  if (omega1Input && Number(omega1Input.value) !== state.conditions.omega_1) {
    omega1Input.value = state.conditions.omega_1;
  }
  if (omega2Input && Number(omega2Input.value) !== state.conditions.omega_2) {
    omega2Input.value = state.conditions.omega_2;
  }
}

// Interactive control functions with proper error handling
function updateParameter(param, value) {
  const state = stateManager.getState();
  const numericValue = parseFloat(value);

  // Update display value immediately with null check
  const displayId = param.replace("_", "-");
  const displayEl = document.getElementById(displayId);
  if (displayEl) {
    displayEl.textContent =
      param === "g" ? numericValue.toFixed(1) : numericValue.toFixed(0);
  }

  // Update slider input value to match
  const inputId = param.replace("_", "-") + "-input";
  const inputEl = document.getElementById(inputId);
  if (inputEl && Number(inputEl.value) !== numericValue) {
    inputEl.value = numericValue;
  }

  // Update state manager
  stateManager.updateState(`parameters.${param}`, numericValue);

  // Debounce server updates
  const timeouts = state.updateTimeouts;
  if (timeouts[param]) {
    clearTimeout(timeouts[param]);
  }

  timeouts[param] = setTimeout(() => {
    fetch("/update_parameter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parameter: param,
        value: numericValue,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Parameter updated successfully, state will be synced on next poll
          console.log("Parameter updated:", data.parameter, "=", data.value);
        } else {
          console.error("Failed to update parameter:", data.error);
        }
      })
      .catch((error) => {
        console.error("Error updating parameter:", error);
      });

    // Update timeouts in state
    stateManager.setState(
      { updateTimeouts: { ...timeouts, [param]: null } },
      "timeout_cleanup"
    );
  }, 100);
}

function updateInitialCondition(condition, value) {
  const state = stateManager.getState();
  const numericValue = parseFloat(value);

  // Update display value immediately (for the initial conditions display)
  const displayEl = document.getElementById(condition + "-display");
  if (displayEl) {
    displayEl.textContent = numericValue.toFixed(1);
  }

  // Update the Angular Motion display values as well
  const angularDisplayEl = document.getElementById(condition);
  if (angularDisplayEl) {
    angularDisplayEl.textContent = numericValue.toFixed(2);
  }

  // Update slider input value to match
  const inputEl = document.getElementById(condition + "-input");
  if (inputEl && Number(inputEl.value) !== numericValue) {
    inputEl.value = numericValue;
  }

  // Update state manager
  stateManager.updateState(`conditions.${condition}`, numericValue);

  // Debounce server updates
  const timeouts = state.updateTimeouts;
  if (timeouts[condition]) {
    clearTimeout(timeouts[condition]);
  }

  timeouts[condition] = setTimeout(() => {
    fetch("/update_initial_condition", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        condition: condition,
        value: numericValue,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Condition updated successfully, state will be synced on next poll
          console.log("Condition updated:", data.condition, "=", data.value);
        } else {
          console.error("Failed to update condition:", data.error);
        }
      })
      .catch((error) => {
        console.error("Error updating condition:", error);
      });

    // Update timeouts in state
    stateManager.setState(
      { updateTimeouts: { ...timeouts, [condition]: null } },
      "timeout_cleanup"
    );
  }, 100);
}

function setPreset(preset) {
  let params = {};

  switch (preset) {
    case "chaotic":
      params = {
        theta_1: 1.57,
        theta_2: 1.57,
        omega_1: 0,
        omega_2: 0,
        length_rod_1: 120,
        length_rod_2: 120,
        mass_bob_1: 10,
        mass_bob_2: 10,
        g: 9.81,
      };
      break;
    case "simple":
      params = {
        theta_1: 1.0,
        theta_2: 0,
        omega_1: 0,
        omega_2: 0,
        length_rod_1: 120,
        length_rod_2: 0,
        mass_bob_1: 10,
        mass_bob_2: 0,
        g: 9.81,
      };
      break;
    case "upright":
      params = {
        theta_1: 3.14,
        theta_2: 3.14,
        omega_1: 0,
        omega_2: 0,
        length_rod_1: 120,
        length_rod_2: 120,
        mass_bob_1: 10,
        mass_bob_2: 10,
        g: 9.81,
      };
      break;
  }

  fetch("/update_preset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update UI sliders to match the preset values
        updateUISliders(params);
        // Also update the state manager immediately for better UX
        const stateUpdates = {};

        // Separate parameters and conditions
        Object.keys(params).forEach((key) => {
          if (
            [
              "length_rod_1",
              "length_rod_2",
              "mass_bob_1",
              "mass_bob_2",
              "g",
            ].includes(key)
          ) {
            stateUpdates[`parameters.${key}`] = params[key];
          } else if (
            ["theta_1", "theta_2", "omega_1", "omega_2"].includes(key)
          ) {
            stateUpdates[`conditions.${key}`] = params[key];
          }
        });

        // Update state manager
        Object.keys(stateUpdates).forEach((path) => {
          stateManager.updateState(path, stateUpdates[path]);
        });

        console.log("Preset applied successfully:", preset);
      } else {
        console.error(
          "Failed to apply preset:",
          data.errors || "Unknown error"
        );
      }
    })
    .catch((error) => {
      console.error("Error applying preset:", error);
    });
}

function updateUISliders(params) {
  // Update UI sliders and displays to match preset
  Object.keys(params).forEach((key) => {
    // Handle different input ID patterns
    let inputId = key + "-input";
    if (key === "length_rod_1") inputId = "length-1-input";
    else if (key === "length_rod_2") inputId = "length-2-input";
    else if (key === "mass_bob_1") inputId = "mass-1-input";
    else if (key === "mass_bob_2") inputId = "mass-2-input";
    else if (key === "g") inputId = "gravity-input";

    const element = document.getElementById(inputId);
    if (element) {
      element.value = params[key];
    }

    // Update initial conditions display value
    const displayKey = key.includes("_")
      ? key.replace("_", "-")
      : key + "-display";
    const displayEl = document.getElementById(displayKey);
    if (displayEl) {
      displayEl.textContent =
        typeof params[key] === "number"
          ? params[key].toFixed(key === "g" ? 1 : 0)
          : params[key];
    }

    // Also update the Angular Motion section display for theta and omega values
    if (["theta_1", "theta_2", "omega_1", "omega_2"].includes(key)) {
      const angularDisplayEl = document.getElementById(key);
      if (angularDisplayEl) {
        angularDisplayEl.textContent = params[key].toFixed(2);
      }
    }
  });
}

function resetToDefaults() {
  const defaults = {
    theta_1: 1.57,
    theta_2: 1.57,
    omega_1: 0,
    omega_2: 0,
    length_rod_1: 120,
    length_rod_2: 120,
    mass_bob_1: 10,
    mass_bob_2: 10,
    g: 9.81,
  };

  fetch("/reset_simulation", {
    method: "POST",
  })
    .then((response) => {
      if (response.ok) {
        updateUISliders(defaults);
        resetPendulum();

        // Also update the Angular Motion section displays immediately
        const theta1El = document.getElementById("theta-1");
        const theta2El = document.getElementById("theta-2");
        const omega1El = document.getElementById("omega-1");
        const omega2El = document.getElementById("omega-2");

        if (theta1El) theta1El.textContent = defaults.theta_1.toFixed(2);
        if (theta2El) theta2El.textContent = defaults.theta_2.toFixed(2);
        if (omega1El) omega1El.textContent = defaults.omega_1.toFixed(2);
        if (omega2El) omega2El.textContent = defaults.omega_2.toFixed(2);

        // Reset state
        stateManager.setState(
          {
            initialEnergy: null,
            updateTimeouts: {},
          },
          "reset"
        );
      }
    })
    .catch((error) => {
      console.error("Error resetting simulation:", error);
    });
}

// Control functions
function resetPendulum() {
  // Clear trails
  trail1.length = 0;
  trail2.length = 0;

  // Reset energy display
  const kineticEl = document.getElementById("kinetic-energy");
  const potentialEl = document.getElementById("potential-energy");
  const totalEl = document.getElementById("total-energy");
  const errorEl = document.getElementById("energy-error");

  if (kineticEl) kineticEl.textContent = "0.00";
  if (potentialEl) potentialEl.textContent = "0.00";
  if (totalEl) totalEl.textContent = "0.00";
  if (errorEl) {
    errorEl.textContent = "0.00%";
    errorEl.style.color = "#6c757d";
  }
}

function togglePause() {
  const state = stateManager.getState();
  const newPausedState = !state.isPaused;
  stateManager.setState({ isPaused: newPausedState }, "pause_toggle");

  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.textContent = newPausedState ? "Resume" : "Pause";
  }
}

function toggleTrails() {
  const state = stateManager.getState();
  const newTrailsState = !state.showTrails;
  stateManager.setState({ showTrails: newTrailsState }, "trail_toggle");

  if (!newTrailsState) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Connection management
function handleConnectionError() {
  const state = stateManager.getState();
  const newRetries = state.connectionRetries + 1;

  stateManager.setState({ connectionRetries: newRetries }, "connection_error");

  if (newRetries >= maxRetries && state.isConnected) {
    stateManager.setState({ isConnected: false }, "connection_lost");
  }
}

function updateConnectionStatus(connected) {
  if (statusIndicator) {
    statusIndicator.className = connected
      ? "status-indicator"
      : "status-indicator error";
  }
  if (statusText) {
    statusText.textContent = connected ? "Connected" : "Connection Lost";
  }
}

// Animation loop
function animate() {
  const state = stateManager.getState();

  // FPS calculation
  const now = performance.now();
  const newFrameCount = state.frameCount + 1;

  if (now - (state.lastFpsUpdate || 0) >= 1000) {
    const newFps = newFrameCount;
    stateManager.setState(
      {
        fps: newFps,
        frameCount: 0,
        lastFpsUpdate: now,
      },
      "fps_update"
    );

    const fpsEl = document.getElementById("fps");
    if (fpsEl) fpsEl.textContent = newFps;
  } else {
    stateManager.setState({ frameCount: newFrameCount }, "frame_count");
  }

  if (state.latestCoords && !state.isPaused) {
    // Update trails
    trail1.push({ x: state.latestCoords[0].x, y: state.latestCoords[0].y });
    trail2.push({ x: state.latestCoords[1].x, y: state.latestCoords[1].y });
    if (trail1.length > MAX_TRAIL) trail1.shift();
    if (trail2.length > MAX_TRAIL) trail2.shift();

    // Draw scene
    drawPendulum(state.latestCoords);

    // Draw trails if enabled
    if (state.showTrails) {
      drawTrail(trail1, "rgba(25,118,210,0.7)");
      drawTrail(trail2, "rgba(239,108,0,0.7)");
    }

    // Update trail length display
    const trailLengthEl = document.getElementById("trail-length");
    if (trailLengthEl) {
      trailLengthEl.textContent = Math.max(trail1.length, trail2.length);
    }
  }
  requestAnimationFrame(animate);
}
