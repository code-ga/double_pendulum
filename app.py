# This code is provided by Hack Club for use in our #accelerate program.
# It is licensed under the MIT License (see LICENSE).
# Feel free to use and modify it as you see fit!

# Remember to install Hackatime, and use it to track your coding time!

# Your goal is to think outside the box. Think about what cool features you could add to this model.

# You have two weeks for this. You must submit your progress by the end of the first week, and your final project by the end of the second week.

import math, threading
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)


class Double_Pendulum:
    """
    Double Pendulum Physics Simulation

    This class simulates a double pendulum system using Lagrangian mechanics.
    The system consists of two pendulum bobs connected by massless rods.

    Key Physics Concepts:
    - Kinetic Energy: Energy due to motion of the bobs
    - Potential Energy: Gravitational potential energy relative to origin
    - Lagrangian: L = T - V (Kinetic - Potential energy)
    - Equations of motion derived from Euler-Lagrange equations
    """

    def __init__(
        self,
        origin_x: float = 300,
        origin_y: float = 100,
        length_rod_1: float = 120,
        length_rod_2: float = 120,
        mass_rod_1: float = 10,
        mass_rod_2: float = 10,
        mass_bob_1: float = 10,
        mass_bob_2: float = 10,
        g: float = 9.81,
        theta_1: float = math.pi / 2,
        theta_2: float = math.pi / 2,
        omega_1: float = 0.0,
        omega_2: float = 0.0,
    ):
        # Position coordinates
        self.origin_x = origin_x
        self.origin_y = origin_y

        # Physical parameters
        self.length_rod_1 = length_rod_1  # Length of first rod
        self.length_rod_2 = length_rod_2  # Length of second rod
        self.mass_bob_1 = mass_bob_1  # Mass of first bob
        self.mass_bob_2 = mass_bob_2  # Mass of second bob
        self.g = g  # Gravitational Acceleration (m/s²)

        # Initial conditions (angular positions and velocities)
        self.theta_1 = theta_1  # Angle of first pendulum from vertical (radians)
        self.theta_2 = theta_2  # Angle of second pendulum from vertical (radians)
        self.omega_1 = omega_1  # Angular velocity of first pendulum (rad/s)
        self.omega_2 = omega_2  # Angular velocity of second pendulum (rad/s)

        # Calculate initial Cartesian coordinates
        self.x_1 = self.origin_x + self.length_rod_1 * math.sin(self.theta_1)
        self.y_1 = self.origin_y + self.length_rod_1 * math.cos(self.theta_1)
        self.x_2 = self.x_1 + self.length_rod_2 * math.sin(self.theta_2)
        self.y_2 = self.y_1 + self.length_rod_2 * math.cos(self.theta_2)

        # Note: rod masses are stored but not used in current implementation
        # (assuming massless rods for simplicity)
        self.mass_rod_1 = mass_rod_1
        self.mass_rod_2 = mass_rod_2

    def step(self, dt: float = 0.06):
        """
        Update the double pendulum state using numerical integration.

        This implements the equations of motion derived from the Lagrangian:
        L = T - V, where T is kinetic energy and V is potential energy.

        The accelerations are calculated using the coupled differential equations
        that describe the chaotic behavior of a double pendulum system.
        """
        # Optimization: If length of rod_2 is zero, skip the second pendulum
        # This effectively makes the system behave like a single pendulum
        if self.length_rod_2 == 0:
            # Only update the first pendulum's motion
            # Calculate acceleration for first pendulum
            delta = self.theta_2 - self.theta_1
            acceleration_1 = -self.g * math.sin(self.theta_1) / self.length_rod_1

            # Update angular velocity
            self.omega_1 += acceleration_1 * dt

            # Update angle
            self.theta_1 += self.omega_1 * dt

            # Update positions
            self.x_1 = self.origin_x + self.length_rod_1 * math.sin(self.theta_1)
            self.y_1 = self.origin_y + self.length_rod_1 * math.cos(self.theta_1)
            # Second bob stays at first bob's position
            self.x_2 = self.x_1
            self.y_2 = self.y_1
            return

        # Optimization: If mass of bob_2 is zero, skip calculations involving it
        # This effectively makes the system behave like a single pendulum
        if self.mass_bob_2 == 0:
            # For single pendulum behavior when bob_2 has no mass
            # Only update the first pendulum's motion
            delta = self.theta_2 - self.theta_1

            # Simplified denominator for single pendulum
            denominator_1 = self.mass_bob_1 * self.length_rod_1

            # Angular acceleration for first pendulum (no coupling from bob_2)
            acceleration_1 = -self.g * math.sin(self.theta_1) / self.length_rod_1

            # For bob_2, only update its motion without affecting bob_1
            acceleration_2 = -self.g * math.sin(self.theta_2) / self.length_rod_2

            # Update angular velocities
            self.omega_1 += acceleration_1 * dt
            self.omega_2 += acceleration_2 * dt

            # Update angles
            self.theta_1 += self.omega_1 * dt
            self.theta_2 += self.omega_2 * dt

            # Update positions
            self.x_1 = self.origin_x + self.length_rod_1 * math.sin(self.theta_1)
            self.y_1 = self.origin_y + self.length_rod_1 * math.cos(self.theta_1)
            self.x_2 = self.x_1 + self.length_rod_2 * math.sin(self.theta_2)
            self.y_2 = self.y_1 + self.length_rod_2 * math.cos(self.theta_2)
            return

        # Angular difference between the two pendulums
        delta = self.theta_2 - self.theta_1

        # Common denominators for the acceleration equations
        # These arise from the coupled nature of the system
        denominator_1 = (
            self.mass_bob_1 + self.mass_bob_2
        ) * self.length_rod_1 - self.mass_bob_2 * self.length_rod_1 * math.cos(
            delta
        ) ** 2

        denominator_2 = (self.length_rod_2 / self.length_rod_1) * denominator_1

        # Angular acceleration of first pendulum (α₁ = d²θ₁/dt²)
        # This complex equation comes from the Euler-Lagrange equations
        acceleration_1 = (
            # Centripetal force terms from both pendulums
            self.mass_bob_2
            * self.length_rod_1
            * self.omega_1**2
            * math.sin(delta)
            * math.cos(delta)
            # Gravitational coupling term
            + self.mass_bob_2 * self.g * math.sin(self.theta_2) * math.cos(delta)
            # Velocity coupling term from second pendulum
            + self.mass_bob_2 * self.length_rod_2 * self.omega_2**2 * math.sin(delta)
            # Main gravitational term for first pendulum
            - (self.mass_bob_1 + self.mass_bob_2) * self.g * math.sin(self.theta_1)
        ) / denominator_1

        # Angular acceleration of second pendulum (α₂ = d²θ₂/dt²)
        acceleration_2 = (
            # Centripetal force coupling term
            -self.mass_bob_2
            * self.length_rod_2
            * self.omega_2**2
            * math.sin(delta)
            * math.cos(delta)
            # Gravitational coupling from first pendulum
            + (self.mass_bob_1 + self.mass_bob_2)
            * self.g
            * math.sin(self.theta_1)
            * math.cos(delta)
            # Velocity coupling from first pendulum
            - (self.mass_bob_1 + self.mass_bob_2)
            * self.length_rod_1
            * self.omega_1**2
            * math.sin(delta)
            # Main gravitational term for second pendulum
            - (self.mass_bob_1 + self.mass_bob_2) * self.g * math.sin(self.theta_2)
        ) / denominator_2

        # Update angular velocities using Euler integration
        self.omega_1 += acceleration_1 * dt  # ω₁ = ω₁ + α₁·dt
        self.omega_2 += acceleration_2 * dt  # ω₂ = ω₂ + α₂·dt

        # Update angular positions
        self.theta_1 += self.omega_1 * dt  # θ₁ = θ₁ + ω₁·dt
        self.theta_2 += self.omega_2 * dt  # θ₂ = θ₂ + ω₂·dt

        # Update Cartesian coordinates from new angular positions
        self.x_1 = self.origin_x + self.length_rod_1 * math.sin(self.theta_1)
        self.y_1 = self.origin_y + self.length_rod_1 * math.cos(self.theta_1)
        self.x_2 = self.x_1 + self.length_rod_2 * math.sin(self.theta_2)
        self.y_2 = self.y_1 + self.length_rod_2 * math.cos(self.theta_2)

    def get_coords(self):
        """Return current Cartesian coordinates of both pendulum bobs."""
        return [{"x": self.x_1, "y": self.y_1}, {"x": self.x_2, "y": self.y_2}]

    def calculate_kinetic_energy(self):
        """
        Calculate the total kinetic energy of the double pendulum system.

        Kinetic Energy (T) = ½ * m₁ * v₁² + ½ * m₂ * v₂²

        Where velocities are calculated from angular velocities:
        v₁ = ω₁ * L₁ (tangential velocity of first bob)
        v₂ = √[(ω₁*L₁*cos(θ₁) + ω₂*L₂*cos(θ₂))² + (ω₁*L₁*sin(θ₁) + ω₂*L₂*sin(θ₂))²]
        (velocity of second bob relative to ground frame)
        """
        # Velocity components for first bob
        vx1 = self.omega_1 * self.length_rod_1 * math.cos(self.theta_1)
        vy1 = -self.omega_1 * self.length_rod_1 * math.sin(self.theta_1)
        v1_squared = vx1**2 + vy1**2

        # Velocity components for second bob (relative to first bob + first bob motion)
        vx2 = self.omega_1 * self.length_rod_1 * math.cos(
            self.theta_1
        ) + self.omega_2 * self.length_rod_2 * math.cos(self.theta_2)
        vy2 = -self.omega_1 * self.length_rod_1 * math.sin(
            self.theta_1
        ) - self.omega_2 * self.length_rod_2 * math.sin(self.theta_2)
        v2_squared = vx2**2 + vy2**2

        # Total kinetic energy
        kinetic_energy = (
            0.5 * self.mass_bob_1 * v1_squared + 0.5 * self.mass_bob_2 * v2_squared
        )
        return kinetic_energy

    def calculate_potential_energy(self):
        """
        Calculate the total gravitational potential energy of the system.

        Potential Energy (V) = m₁ * g * h₁ + m₂ * g * h₂

        Where h is the height relative to the origin point.
        We use the y-coordinate (inverted since y increases downward in screen coordinates).
        """
        # Height of each bob relative to origin (negative since y increases downward)
        h1 = -(self.y_1 - self.origin_y)
        h2 = -(self.y_2 - self.origin_y)

        # Total potential energy
        potential_energy = self.mass_bob_1 * self.g * h1 + self.mass_bob_2 * self.g * h2
        return potential_energy

    def calculate_total_energy(self):
        """
        Calculate the total mechanical energy of the system.

        Total Energy (E) = Kinetic Energy + Potential Energy

        In an ideal system (no friction), this should remain constant,
        demonstrating conservation of energy.
        """
        return self.calculate_kinetic_energy() + self.calculate_potential_energy()

    def get_energy_data(self):
        """Return all energy components as a dictionary."""
        return {
            "kinetic": self.calculate_kinetic_energy(),
            "potential": self.calculate_potential_energy(),
            "total": self.calculate_total_energy(),
        }


# Create simulation instance
double_pendulum = Double_Pendulum()


def run_simulation():
    while True:
        try:
            double_pendulum.step()
        except Exception as e:
            print("Error occurred in simulation:", e)
        threading.Event().wait(0.03)


# Start simulation in background thread
threading.Thread(target=run_simulation, daemon=True).start()


# route to the simulation page
@app.route("/")
def index():
    return render_template(
        "index.html",
        origin_x=double_pendulum.origin_x,
        origin_y=double_pendulum.origin_y,
    )


# route to get pendulum coords
@app.route("/coords")
def coords():
    return jsonify(double_pendulum.get_coords())


# route to get energy data
@app.route("/energy")
def energy():
    """API endpoint to get current energy values of the double pendulum."""
    return jsonify(double_pendulum.get_energy_data())


# route to get full pendulum state
@app.route("/state")
def state():
    """API endpoint to get full pendulum state including angles, velocities, and all parameters."""
    return jsonify(
        {
            # Physical parameters
            "origin_x": double_pendulum.origin_x,
            "origin_y": double_pendulum.origin_y,
            "length_rod_1": double_pendulum.length_rod_1,
            "length_rod_2": double_pendulum.length_rod_2,
            "mass_rod_1": double_pendulum.mass_rod_1,
            "mass_rod_2": double_pendulum.mass_rod_2,
            "mass_bob_1": double_pendulum.mass_bob_1,
            "mass_bob_2": double_pendulum.mass_bob_2,
            "g": double_pendulum.g,
            # Angular state
            "theta_1": double_pendulum.theta_1,
            "theta_2": double_pendulum.theta_2,
            "omega_1": double_pendulum.omega_1,
            "omega_2": double_pendulum.omega_2,
            # Derived values
            "coords": double_pendulum.get_coords(),
            "energy": double_pendulum.get_energy_data(),
        }
    )


# route to update simulation parameters
@app.route("/update_parameter", methods=["POST"])
def update_parameter():
    """API endpoint to update a simulation parameter."""
    data = request.get_json()
    parameter = data.get("parameter")
    value = float(data.get("value"))

    # Validate that parameter exists
    if not hasattr(double_pendulum, parameter):
        return (
            jsonify({"success": False, "error": f"Parameter {parameter} not found"}),
            400,
        )

    # Special validation for certain parameters
    if parameter in ["length_rod_1", "length_rod_2"]:
        if value < 0:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": f"Parameter {parameter} cannot be negative",
                    }
                ),
                400,
            )
    elif parameter in ["mass_bob_1", "mass_bob_2", "mass_rod_1", "mass_rod_2"]:
        if value < 0:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": f"Parameter {parameter} cannot be negative",
                    }
                ),
                400,
            )
    elif parameter == "g":
        if value < 0:
            return (
                jsonify({"success": False, "error": "Gravity cannot be negative"}),
                400,
            )

    # Update the parameter
    setattr(double_pendulum, parameter, value)

    # Recalculate coordinates if rod lengths were changed
    if parameter in ["length_rod_1", "length_rod_2", "theta_1", "theta_2"]:
        double_pendulum.x_1 = (
            double_pendulum.origin_x
            + double_pendulum.length_rod_1 * math.sin(double_pendulum.theta_1)
        )
        double_pendulum.y_1 = (
            double_pendulum.origin_y
            + double_pendulum.length_rod_1 * math.cos(double_pendulum.theta_1)
        )
        double_pendulum.x_2 = (
            double_pendulum.x_1
            + double_pendulum.length_rod_2 * math.sin(double_pendulum.theta_2)
        )
        double_pendulum.y_2 = (
            double_pendulum.y_1
            + double_pendulum.length_rod_2 * math.cos(double_pendulum.theta_2)
        )

    return jsonify({"success": True, "parameter": parameter, "value": value})


# route to update initial conditions
@app.route("/update_initial_condition", methods=["POST"])
def update_initial_condition():
    """API endpoint to update initial conditions (angles and velocities)."""
    data = request.get_json()
    condition = data.get("condition")
    value = float(data.get("value"))

    # Validate that condition exists
    if not hasattr(double_pendulum, condition):
        return (
            jsonify({"success": False, "error": f"Condition {condition} not found"}),
            400,
        )

    # Validate that value is a number (already converted to float above)

    # Update the condition
    setattr(double_pendulum, condition, value)

    # Recalculate coordinates if angles were changed
    if condition in ["theta_1", "theta_2", "length_rod_1", "length_rod_2"]:
        double_pendulum.x_1 = (
            double_pendulum.origin_x
            + double_pendulum.length_rod_1 * math.sin(double_pendulum.theta_1)
        )
        double_pendulum.y_1 = (
            double_pendulum.origin_y
            + double_pendulum.length_rod_1 * math.cos(double_pendulum.theta_1)
        )
        double_pendulum.x_2 = (
            double_pendulum.x_1
            + double_pendulum.length_rod_2 * math.sin(double_pendulum.theta_2)
        )
        double_pendulum.y_2 = (
            double_pendulum.y_1
            + double_pendulum.length_rod_2 * math.cos(double_pendulum.theta_2)
        )

    return jsonify({"success": True, "condition": condition, "value": value})


# route to update multiple parameters (for presets)
@app.route("/update_preset", methods=["POST"])
def update_preset():
    """API endpoint to update multiple parameters at once (for presets)."""
    data = request.get_json()
    updated_params = []
    errors = []

    for parameter, value in data.items():
        if not hasattr(double_pendulum, parameter):
            errors.append(f"Parameter {parameter} not found")
            continue

        # Validate certain parameters
        if parameter in ["length_rod_1", "length_rod_2"]:
            if float(value) < 0:
                errors.append(f"Parameter {parameter} cannot be negative")
                continue
        elif parameter in ["mass_bob_1", "mass_bob_2", "mass_rod_1", "mass_rod_2"]:
            if float(value) < 0:
                errors.append(f"Parameter {parameter} cannot be negative")
                continue
        elif parameter == "g":
            if float(value) < 0:
                errors.append("Gravity cannot be negative")
                continue

        # Update the parameter
        setattr(double_pendulum, parameter, float(value))
        updated_params.append(parameter)

    # Recalculate coordinates if angles or rod lengths were updated
    if any(
        param in data
        for param in ["theta_1", "theta_2", "length_rod_1", "length_rod_2"]
    ):
        double_pendulum.x_1 = (
            double_pendulum.origin_x
            + double_pendulum.length_rod_1 * math.sin(double_pendulum.theta_1)
        )
        double_pendulum.y_1 = (
            double_pendulum.origin_y
            + double_pendulum.length_rod_1 * math.cos(double_pendulum.theta_1)
        )
        double_pendulum.x_2 = (
            double_pendulum.x_1
            + double_pendulum.length_rod_2 * math.sin(double_pendulum.theta_2)
        )
        double_pendulum.y_2 = (
            double_pendulum.y_1
            + double_pendulum.length_rod_2 * math.cos(double_pendulum.theta_2)
        )

    if errors:
        return (
            jsonify({"success": False, "errors": errors, "updated": updated_params}),
            400,
        )

    return jsonify({"success": True, "parameters": updated_params})


# route to reset simulation to default values
@app.route("/reset_simulation", methods=["POST"])
def reset_simulation():
    """API endpoint to reset simulation to default values."""
    global double_pendulum
    double_pendulum = Double_Pendulum()
    return jsonify({"success": True, "message": "Simulation reset to defaults"})
