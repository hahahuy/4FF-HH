# Drone Engineering Career Guide — EE Background Track (Vietnam / SEA)
> **Tailored for:** Electrical Engineering student (≈ 2nd year equivalent)
> **Market:** Vietnam & Southeast Asia
> **Updated:** March 2026

---

## Your EE Advantage (What You Already Have)

As a 2nd-year EE equivalent, you likely already have or are building:

| Already Have ✅ | Needs Bridging 🔧 | Build From Scratch 🆕 |
|---|---|---|
| Circuit analysis | PCB design (KiCad/Altium) | ROS / ROS2 |
| Basic C/C++ | RTOS & embedded firmware | SLAM / autonomy |
| Signals & systems | Power electronics (BECs, ESCs) | Computer vision |
| Math (linear algebra, diff eq) | Sensor interfacing (SPI, I2C, UART) | Python (if not yet) |
| Lab & measurement skills | Control theory (PID/state-space) | MAVLink protocol |

> **Key insight:** EE is the *closest* base to drone hardware engineering. You'll ramp up faster than CS or ME students on the physical systems side. Focus on bridging embedded + control, then layer on software.

---

## 1. Roles Best Suited for Your EE Background

These roles align **directly** with your electrical foundation:

### 🔴 Primary Targets (High EE Overlap)

#### UAV Hardware / Electrical Engineer
- Design power distribution boards, ESC selection, battery management systems (BMS)
- RF link design, antenna selection, signal integrity
- Sensor integration (IMU, GPS, barometer, lidar) via SPI/I2C/UART
- PCB design for flight computers and peripheral boards
- **Salary:** $90k–$145k → growing to $115k–$165k
- **Your edge:** Circuit analysis + lab skills transfer directly

#### Embedded / Flight Software Engineer
- Write firmware for flight controllers (Pixhawk, custom STM32 boards)
- Real-time control loops, interrupt-driven systems, RTOS (FreeRTOS, NuttX)
- MAVLink message handling, PX4/ArduPilot module development
- **Salary:** $100k–$160k
- **Your edge:** C/C++ base + understanding of hardware timing/interrupts

#### UAV Systems Engineer
- Full system integration: RF links, power budgets, sensor fusion, comms architecture
- Write system requirements, interface control documents (ICDs)
- Validate and test full vehicle performance
- **Salary:** $95k–$165k
- **Your edge:** Systems thinking from EE design courses

#### Drone Autopilot / Control Engineer
- Implement PID, LQR, MPC controllers for flight stabilization
- Kalman/EKF sensor fusion for IMU + GPS + baro + magnetometer
- MATLAB/Simulink modeling → C/C++ code generation
- **Salary:** $100k–$155k
- **Your edge:** Control theory and signals/systems background

---

### 🟡 Reachable with Upskilling (6–12 months)

#### Computer Vision / Perception Engineer
- Object detection, SLAM, visual odometry onboard drones
- OpenCV, PyTorch/TensorFlow on Jetson Nano/Xavier (edge AI)
- Requires: Python + ML fundamentals first
- **Salary:** $110k–$175k

#### Ground Systems / Communication Engineer
- RF system design, telemetry links, encrypted communication
- Software-defined radio (SDR) for drone signal analysis
- Your RF/electromagnetics coursework is a direct asset here
- **Salary:** $90k–$140k

---

### 🔵 Long-term / Specialized

| Role | What to Add |
|---|---|
| UAV Cybersecurity Engineer | Network security, crypto, penetration testing |
| eVTOL / UAM Systems Engineer | Aerospace cert knowledge (DO-178C, DO-254) |
| R&D / Research Engineer | MSc/PhD + publications |

---

## 2. Skills Roadmap for EE Students

### Phase 1 — Strengthen Your EE Core for Drones (Months 1–3)

These are **EE skills** you need to sharpen specifically for UAV work:

**Power Systems**
- LiPo battery chemistry: C-ratings, cell balancing, BMS design
- Power distribution board (PDB) design — voltage regulation, current sensing
- BEC (Battery Eliminator Circuit), UBEC selection
- Motor/ESC matching: KV ratings, thrust curves, efficiency

**Embedded Systems**
- STM32 microcontroller (used in Pixhawk) — timers, DMA, UART, SPI, I2C
- FreeRTOS basics — tasks, queues, mutexes
- PWM generation for ESCs and servos
- MAVLINK protocol — packet structure, message encoding
- Tools: STM32CubeIDE, PlatformIO, OpenOCD

**Sensors & Signal Processing**
- IMU (MPU6050, ICM-42688) — calibration, noise filtering
- GPS/GNSS — NMEA parsing, RTK-GPS concepts
- Barometer (MS5611) — altitude fusion
- Magnetometer calibration and hard/soft iron correction
- Kalman Filter and Complementary Filter — implement from scratch

**RF & Communications**
- 2.4 GHz / 5.8 GHz RC link fundamentals
- FHSS vs DSSS spreading
- Telemetry radios (SiK 915 MHz)
- FPV video link design (analog vs digital)
- Basic link budget calculations

---

### Phase 2 — Add the Software Layer (Months 3–6)

**Python (if not yet)**
- NumPy, SciPy for numerical work
- MAVProxy / DroneKit-Python for vehicle scripting
- Pandas + Matplotlib for flight log analysis

**ROS / ROS2**
- Publisher/subscriber, services, actions
- URDF robot models, TF transforms
- rosbag recording and playback
- ROS + Gazebo SITL simulation

**Control Theory (Applied)**
- PID tuning methodology (Ziegler-Nichols, manual)
- State-space representation → pole placement
- Extended Kalman Filter (EKF) — implement in Python/C++
- MATLAB Simulink: quadrotor dynamics model

---

### Phase 3 — Specialize (Months 6–12+)

Pick one deep specialization to anchor your CV:

| Track | Key Skills to Add |
|---|---|
| **Hardware/Power** | Altium/KiCad PCB, DO-254 basics, EMI/EMC |
| **Embedded/Firmware** | PX4 module dev, NuttX RTOS, CAN bus (DroneCAN) |
| **Control/Autonomy** | SLAM, path planning (A*, RRT), MPC |
| **RF/Comms** | SDR (GNU Radio), encrypted MAVLink, anti-spoofing |

---

## 3. Vietnam Regulatory Landscape 🇻🇳

Understanding local law is **non-negotiable** before flying commercially or working professionally.

### Key Regulation: Nghị định 36/2024/NĐ-CP
This is the primary decree governing unmanned aircraft in Vietnam (effective 2024), replacing the older Decree 04/2013. Key points:

| Category | Weight | Rules |
|---|---|---|
| **Nhóm 1** | < 0.25 kg | Minimal restrictions, no permit needed |
| **Nhóm 2** | 0.25–5 kg | Must register with CAAV, restricted zones apply |
| **Nhóm 3** | 5–25 kg | Full permit required, pilot certification |
| **Nhóm 4** | 25–150 kg | Special authorization, defense/civil aviation approval |
| **Nhóm 5** | > 150 kg | Full airworthiness certification |

### Governing Body
- **CAAV** — Cục Hàng không Việt Nam (Civil Aviation Authority of Vietnam)
  - Website: caav.gov.vn
  - Controls all airspace, permits, and operator registrations

### What You Need for Commercial Work in Vietnam
1. **Đăng ký phương tiện bay** — Register your drone with CAAV (mandatory for >250g)
2. **Giấy phép bay** — Flight permit per operation zone (request via CAAV portal)
3. **Pilot proficiency** — No formal Vietnamese pilot license system yet (as of 2026), but CAAV is developing one. Operators must demonstrate competency
4. **Insurance** — Required for commercial operations

### Restricted Zones to Know
- Within 8 km of airports (Tân Sơn Nhất, Nội Bài, Đà Nẵng)
- Military zones (absolute prohibition)
- Government buildings, central Hà Nội, Hồ Chí Minh City city center
- Use app **CAAV UAS Map** or check NOTAM before any flight

> 💡 **CV Tip:** Write a one-page summary of Nghị định 36/2024 on your portfolio blog. It signals professionalism and regulatory awareness that many Vietnamese drone engineers skip.

---

## 4. Vietnamese & SEA Drone Job Market

### Reality Check — Vietnam vs Global Market

| Aspect | Vietnam | US/Europe |
|---|---|---|
| Drone industry maturity | Emerging (early stage) | Mature |
| Dedicated drone companies | ~10–20 serious players | Thousands |
| Salary range | 15–50M VND/month (~$600–2,000) | $70k–$180k/yr |
| Most common role | Systems integrator / application engineer | Specialized engineer |
| Biggest sectors | Agriculture, mapping/survey, inspection | Defense, delivery, inspection |
| Growth rate | Very fast (35–50% YoY) | 15–25% |

> Vietnam's drone market is **small but growing extremely fast.** Right now it rewards generalists who can do hardware + software + operations. Specialists come later as the industry matures.

---

### Companies Actually Hiring in Vietnam (2025–2026)

#### Agriculture & Agri-Tech (Biggest sector for drones in VN)
| Company | Location | Focus |
|---|---|---|
| **Cục Bảo vệ thực vật** (MARD) | Hà Nội | Policy + ag drone programs |
| **DJI Vietnam** (official reseller: Thiên Nam, Viet UAV) | HCM + HN | Sales, support, training |
| **Viet UAV** | Hà Nội | DJI Agras distribution, ag services |
| **AgriDrone Vietnam** | HCM | Precision spraying services |
| **Rynan Technologies** | Trà Vinh | Smart farming, custom UAV R&D ⭐ |

#### Mapping, Survey & GIS
| Company | Location | Focus |
|---|---|---|
| **Navisky** | Hà Nội | Drone survey, LiDAR mapping |
| **Lat Viet Sciences** | HCM | Photogrammetry, GIS services |
| **Vietmap** | HCM | Maps + drone data processing |
| **Pix4D partners** (various) | HCM/HN | Photogrammetry software users |

#### Defense & Security (State-owned, needs connections)
| Company | Focus |
|---|---|
| **Viettel Aerospace Institute (VTX)** | Military drone R&D, most advanced in VN ⭐⭐ |
| **VNPT Technology** | Surveillance, smart city drones |
| **Bộ Quốc phòng** (MoD) contractors | Fixed-wing recon, border patrol |

#### Inspection & Infrastructure
| Company | Focus |
|---|---|
| **EVN** (Điện lực VN) + contractors | Power line inspection drones |
| **VIMC / PVN** contractors | Offshore oil rig inspection |
| **Viettel Construction** | Bridge/tower inspection |

#### Startups & R&D (Best for early-career learning)
| Company | Focus | Why Join |
|---|---|---|
| **Rynan Technologies** | IoT + drone farming | Custom hardware R&D culture |
| **Sky-Drones Vietnam** (if active) | Autopilot systems | PX4/ArduPilot work |
| **FPT Software** (drone division) | AI + drone analytics | Software side |
| **VinAI Research** | AI/Vision | Research track, drone perception |

> 💡 **Viettel Aerospace (VTX)** is the most technically advanced drone org in Vietnam by far — they build fixed-wing military UAVs. Very hard to get into but worth targeting if you build strong embedded/EE skills.

---

### Salary Expectations in Vietnam

| Level | Experience | Monthly (VND) | Monthly (USD ~) |
|---|---|---|---|
| Fresher / Intern | 0–1 year | 8–15M | $300–600 |
| Junior Engineer | 1–3 years | 15–25M | $600–1,000 |
| Mid-level Engineer | 3–5 years | 25–45M | $1,000–1,800 |
| Senior Engineer | 5+ years | 45–80M | $1,800–3,200 |
| Lead / Architect | 7+ years | 70–120M+ | $2,800–4,800 |

**Salary multipliers in VN context:**
- Working for **foreign company remotely** (US/EU): +200–400% vs local
- **Viettel / state enterprise**: stable but ~20–30% below private
- **Startup with equity**: lower base, higher upside
- **HCM City > Hà Nội > others** for private sector pay

> 🎯 **The real move:** Build skills locally (2–3 years), then target **remote work for foreign drone companies** or **relocate to Singapore, Japan, or EU**. Vietnamese EE drone engineers are in demand globally — they just need an English portfolio.

---

### SEA Regional Opportunities Beyond Vietnam

| Country | Opportunity | Notes |
|---|---|---|
| **Singapore** | Drone R&D hub (DSO, A*STAR, ST Engineering) | Needs EE + autonomy skills, high pay |
| **Thailand** | Agriculture drones, smart cities | Similar market to VN, growing fast |
| **Indonesia** | Massive agriculture + mapping market | Archipelago = huge drone logistics potential |
| **Malaysia** | Defense + palm oil agriculture | Petronas inspection contracts |
| **Philippines** | Mapping + disaster response | Island geography = natural drone market |

**Singapore** is the SEA gold standard for drone engineering careers — ST Engineering Aerospace and DSO National Laboratories are world-class.

---

## 5. Courses & Certifications (Vietnam Context)

### Must-Have Certifications

| Cert | Why | Cost | Time |
|---|---|---|---|
| **CAAV Drone Registration** | Legal requirement to operate >250g commercially | Free (online) | 1–2 hrs |
| **DJI Enterprise Basic** | Most drones in Vietnam are DJI — shows platform fluency | Free | 2–3 hrs |
| **DJI Agras Operator Cert** | Agriculture is #1 sector in VN — very in-demand | Free/low | 4–8 hrs |

### Core Technical Courses (EE-Focused, available in Vietnam)

| Course | Platform | Relevance to EE | Notes |
|---|---|---|---|
| **Drone Engineering Specialization** — U. of Colorado Boulder | Coursera | Propulsion, control, design — ideal EE bridge | ~$40/mo, audit free |
| **Aerial Robotics** — UPenn | Coursera | Dynamics, control theory, 3D motion | ⭐ Highly recommended |
| **Control of Mobile Robots** — Georgia Tech | Coursera | Control theory applied to robotics | Free audit |
| **Embedded Systems** — UT Austin | edX | STM32, RTOS, real-time control | Very relevant |
| **Autonomous Mobile Robots** — ETH Zurich | edX | SLAM, sensors, navigation | More advanced |
| **ROS for Beginners** — Anis Koubaa | Udemy | Practical ROS2 hands-on | ~$10–15 on sale |

> 💡 **Coursera / edX Financial Aid:** Both platforms offer 100% free financial aid for learners in developing countries. Apply via the "Financial Aid" link on each course — approval rate is ~80%+. This is 100% legitimate.

### Vietnamese University Resources

| School | Relevant Dept / Lab | Notes |
|---|---|---|
| **ĐH Bách Khoa HCM (HCMUT)** | Khoa Điện-Điện tử, Cơ điện tử | Strong EE + robotics labs, some UAV thesis topics |
| **ĐH Bách Khoa Hà Nội (HUST)** | SEEE, MICA Institute | MICA has computer vision + robotics research |
| **ĐH Công nghệ (VNU-HN)** | Khoa Điện tử Viễn thông | RF + embedded systems focus |
| **Học viện Kỹ thuật Quân sự** | Aerospace + electronics dept | Military drone research — hard to access but excellent |

> If you're still a student, ask your professor about UAV thesis projects — very few students do this, so you'll stand out immediately.

### Highly Recommended Books

| Book | Why It Matters for You |
|---|---|
| *Small Unmanned Aircraft* — Beard & McLain | The UAV engineering bible. Control theory + implementation |
| *Autonomous Mobile Robots* — Siegwart et al. | Sensors, SLAM, navigation — comprehensive |
| *Programming Robots with ROS* — Quigley et al. | Practical ROS workflows |
| *Introduction to Embedded Systems* — Lee & Seshia | Free PDF — strong real-time systems foundation |
| *Probabilistic Robotics* — Thrun, Burgard, Fox | Kalman filters, SLAM theory — heavy but worth it |

---

## 4. Projects to Build (EE-Optimized Path)

Projects are ordered to leverage your EE skills immediately, then progressively add software.

---

### 🟢 Tier 1 — EE Core Projects (Months 1–3)

#### Project 1: Power Distribution Board (PDB) Design
- **What:** Design and fabricate a custom PDB for a quadcopter using KiCad
  - 4S LiPo input (14.8V), 4× ESC outputs, 5V/12V regulated rails for FC and peripherals
  - Current sensing (INA219 or shunt resistor) for each ESC
- **Deliverable:** KiCad schematic + PCB layout, fabricated board (JLCPCB), test data
- **CV Impact:** ⭐⭐⭐⭐ — shows hardware design skill most CS/ME grads lack
- **Skills Built:** PCB design, power electronics, EMI layout practices
- **Cost:** ~$30–60 for fabrication

#### Project 2: IMU Sensor Fusion — Attitude Estimator from Scratch
- **What:** Read MPU6050 via I2C on STM32 (or Arduino as a start), implement:
  - Complementary filter (simple, fast)
  - Extended Kalman Filter for roll/pitch/yaw
  - Compare both on real hardware with visualization
- **Deliverable:** C/C++ firmware + Python plotter + documented accuracy comparison
- **CV Impact:** ⭐⭐⭐⭐⭐ — fundamental drone skill, demonstrates control theory in practice
- **Skills Built:** Embedded C, sensor interfacing, Kalman filter, data analysis
- **Cost:** <$15 (MPU6050 module)

#### Project 3: ESC & Motor Control — Custom Firmware
- **What:** Write your own ESC controller using STM32 + BLDC motor + gate driver
  - Implement sensorless BLDC commutation (BEMF zero-crossing)
  - Or: Implement FOC (Field-Oriented Control) if ambitious
  - Compare with commercial ESC performance
- **Deliverable:** Firmware + oscilloscope screenshots + performance graphs
- **CV Impact:** ⭐⭐⭐⭐⭐ — very few candidates have this depth. Huge differentiator
- **Skills Built:** Power electronics, STM32, real-time control, motor drives
- **Cost:** $20–50

#### Project 4: Flight Log Analysis Dashboard
- **What:** Parse ArduPilot/PX4 `.bin` / `.ulg` logs in Python
  - Extract IMU, GPS, attitude, battery data
  - Build interactive dashboard (Plotly Dash or Streamlit)
  - Detect anomalies: vibration, GPS loss, voltage sags
- **Deliverable:** GitHub repo + live demo (Streamlit Cloud is free)
- **CV Impact:** ⭐⭐⭐ — shows Python + data skills
- **Skills Built:** Python, data processing, visualization
- **Cost:** Free (use public flight logs from PX4/ArduPilot communities)

---

### 🟡 Tier 2 — Integration Projects (Months 3–6)

#### Project 5: Full Quadcopter Build — Hardware Focus
- **What:** Build a complete flying quadcopter with full documentation:
  - Frame selection rationale (5" freestyle vs 7" long-range)
  - Motor/ESC/prop matching calculations (thrust-to-weight, efficiency)
  - Your custom PDB from Project 1
  - Pixhawk or Matek flight controller integration
  - MAVLink telemetry to laptop via SiK radio
  - PID tuning log with before/after Blackbox data
- **Deliverable:** Build log (photos/video) + design spreadsheet + tuning report
- **CV Impact:** ⭐⭐⭐⭐⭐ — proves end-to-end capability
- **Cost:** $300–600

#### Project 6: RC Controller & Telemetry System (Custom)
- **What:** Design a custom ground station controller:
  - STM32 + ELRS/CRSF protocol transmitter
  - OLED display showing telemetry (voltage, RSSI, GPS, altitude)
  - MAVLink parsing for live data from vehicle
- **Deliverable:** Schematic + firmware + demo video
- **CV Impact:** ⭐⭐⭐⭐ — shows RF + embedded + comms integration
- **Skills Built:** RF protocols, UART, embedded UI, MAVLink

#### Project 7: Gazebo SITL + ROS2 Navigation
- **What:** Set up PX4/ArduPilot SITL in Gazebo, fly autonomous missions via ROS2:
  - Waypoint navigation using offboard control
  - Obstacle detection with simulated lidar
  - MAVLink ↔ ROS2 bridge (px4_ros_com or MAVROS)
- **Deliverable:** Launch files + mission planner + demo GIF
- **CV Impact:** ⭐⭐⭐⭐ — critical for software-side roles
- **Skills Built:** ROS2, MAVLink, simulation, autonomous flight
- **Cost:** Free (software only)

---

### 🔴 Tier 3 — Advanced / Specialty Projects (Months 6–12+)

#### Project 8: Custom Flight Controller (STM32 + FreeRTOS)
- **What:** Build a minimal flight controller from scratch
  - STM32F4/F7 + MPU6050 + barometer + RC input
  - FreeRTOS task architecture: sensor task, control task, comms task
  - PID attitude controller (not using PX4 — your own code)
  - MAVLink heartbeat + attitude output to QGroundControl
- **Deliverable:** Full firmware repo + architecture doc + video of stable hover
- **CV Impact:** ⭐⭐⭐⭐⭐ — exceptional. Very few people build this
- **Skills Built:** RTOS, embedded control, sensor fusion, full system design
- **Cost:** $50–100 (custom PCB + sensors)

#### Project 9: LiDAR-based Obstacle Avoidance (ROS2)
- **What:** Mount RPLiDAR A1 on drone/ground robot, implement:
  - 2D occupancy grid mapping
  - Dynamic obstacle detection
  - Reactive avoidance controller
- **Deliverable:** ROS2 package + rosbag demo + write-up
- **CV Impact:** ⭐⭐⭐⭐ — autonomy credential
- **Cost:** $100 (RPLiDAR A1)

#### Project 10: Drone-Based RF/Signal Mapping
- **What:** Mount SDR (RTL-SDR) on a drone, map signal strength of:
  - WiFi, cellular, or ISM-band signals across an area
  - Generate geo-tagged heatmap
  - Correlate with drone GPS position via ROS
- **Deliverable:** Dataset + heatmap visualization + write-up
- **CV Impact:** ⭐⭐⭐⭐⭐ — niche, highly relevant to comms/defense roles
- **Skills Built:** SDR, GNU Radio, ROS, Python, geospatial analysis
- **Cost:** $30 (RTL-SDR dongle)

#### Project 11: Battery Management System (BMS) Design
- **What:** Design a smart BMS for a 4S LiPo drone battery:
  - Cell voltage monitoring (BQ76940 or similar IC)
  - Overcharge/overdischarge protection
  - Temperature monitoring (NTC)
  - I2C/UART interface to flight controller
  - Fuel gauge (state of charge estimation)
- **Deliverable:** KiCad design + firmware + test data
- **CV Impact:** ⭐⭐⭐⭐⭐ — power electronics depth; eVTOL companies specifically hire for this
- **Cost:** $40–80

---

## 5. 12-Month Vietnam-Focused Roadmap

```
MONTH 1–2: Hardware Foundation + Local Compliance
  ├── Register on CAAV portal, understand Nghị định 36/2024
  ├── Set up STM32 dev environment (Discovery board ~450k VND)
  ├── Project 1: PDB design in KiCad
  ├── Project 2: IMU sensor fusion (MPU6050, ~70k VND)
  └── Apply for Coursera Financial Aid (Aerial Robotics, UPenn)

MONTH 3–4: Embedded + Flight Ops
  ├── Finish Project 2 (EKF working, visualized in Python)
  ├── Project 3: ESC/motor control firmware
  ├── Get DJI Enterprise Basic + DJI Agras cert (both free)
  ├── Fly legally with a borrowed/cheap drone to get field time
  └── FAA Part 107 (skip — not relevant for VN)

MONTH 5–6: Build a Flying Drone + ROS
  ├── Project 5: Full quadcopter build (aim for ~7–10M VND total)
  ├── Start ROS2 tutorials
  ├── Project 7: Gazebo SITL + ROS2 missions
  ├── Document everything on GitHub with English READMEs
  └── Write first blog post in English (Medium or GitHub Pages)

MONTH 7–9: Pick Your Vietnamese Market Niche
  ├── AGRICULTURE TRACK: Build field spray optimizer tool
  │     └── Analyze DJI Agras flight logs, map coverage gaps,
  │         build Python dashboard for farm clients
  ├── MAPPING TRACK: Set up OpenDroneMap pipeline
  │     └── Fly survey mission, process orthomosaic + DEM,
  │         deliver sample report to a local survey firm
  └── DEFENSE TRACK: Contribute to PX4 (board bring-up or drivers)
        └── Build custom FC (Project 8) — best for Viettel path

MONTH 10–12: Portfolio + Job Hunt
  ├── GitHub: 4–6 repos with READMEs, videos, documentation
  ├── Portfolio site (GitHub Pages — free, in English)
  ├── Write 2–3 technical blog posts in English
  ├── Apply to: Rynan, Navisky, Viet UAV, Viettel internship programs
  └── Target Q1–Q2 2027 for first junior role (15–20M VND/month)
```

### Component Costs in Vietnam (2026 estimates)

| Item | VN Cost (VND) | VN Cost (USD ~) | Where to Buy |
|---|---|---|---|
| STM32F4 Discovery | ~450k | ~$18 | shopee.vn, ic.vn |
| MPU6050 module | ~50–80k | ~$3 | shopee.vn |
| Arduino Mega / Uno | ~120–200k | ~$5–8 | shopee.vn, arduinohanoi.vn |
| 5" drone frame kit | ~400–700k | ~$16–28 | shopee.vn, fpvdrone.vn |
| Matek H743 flight controller | ~1.8–2.5M | ~$72–100 | fpvdrone.vn |
| 4S 4000mAh LiPo + charger | ~800k–1.2M | ~$32–48 | fpvdrone.vn |
| RPLiDAR A1 | ~2–2.5M | ~$80–100 | shopee.vn |
| RTL-SDR dongle | ~600–900k | ~$24–36 | shopee.vn |
| JLCPCB PCB order | ~200–400k | ~$8–16 | jlcpcb.com (ships to VN) |
| **Total (essential build)** | **~8–12M VND** | **~$320–480** | |

> 💡 **FPVDrone.vn** (HCM) and **FPVHanoi.com** (HN) are the best local shops for drone components. Shopee is fine for basic electronics modules.

---

## 6. Tools & Hardware Shopping List

### Software (All Free)
| Tool | Purpose |
|---|---|
| KiCad | PCB schematic + layout design |
| STM32CubeIDE | STM32 firmware development |
| PlatformIO (VS Code) | Alternative embedded dev env |
| QGroundControl | Mission planning + telemetry |
| Mission Planner | ArduPilot ground control |
| Gazebo + PX4 SITL | Drone simulation |
| ROS2 (Humble/Jazzy) | Robotics middleware |
| GNU Radio | SDR signal processing |
| MATLAB (student license) | Control system simulation |

### Hardware (Priority Order)
| Item | Cost | Use |
|---|---|---|
| STM32F4 Discovery board | ~$20 | Embedded dev platform |
| MPU6050 module | ~$3 | IMU sensor fusion project |
| DJI Tello (optional starter) | ~$100 | Beginner SDK flight app |
| 5" quadcopter frame kit | ~$30 | Full drone build |
| Pixhawk 6C or Matek H743 FC | ~$80–120 | Flight controller |
| 4S LiPo + charger | ~$50 | Power for build |
| RPLiDAR A1 | ~$100 | LiDAR obstacle avoidance |
| RTL-SDR dongle | ~$30 | RF signal mapping |
| JLCPCB credits | ~$30 | PCB fabrication |
| **Total (essential)** | **~$350–500** | |

---

## 7. What to Put on Your CV (EE Drone Engineer)

### Technical Skills Section
```
Flight Systems:    PX4, ArduPilot, MAVLink, QGroundControl
Embedded:          STM32, FreeRTOS, SPI/I2C/UART, PWM control
Hardware Design:   KiCad (PCB), Power electronics, BMS design
Simulation:        Gazebo SITL, MATLAB/Simulink, ROS2
Languages:         C/C++ (embedded), Python, MATLAB
Sensors:           IMU calibration, EKF, GPS/GNSS, LiDAR
Communications:    RF link design, SiK telemetry, ELRS, SDR
```

### Projects Section (example framing)
```
Custom Flight Controller — STM32 + FreeRTOS
  Built minimal FC from scratch: PID attitude control, EKF sensor fusion,
  MAVLink telemetry. Achieved stable hover on custom quadcopter.
  [GitHub link] [Demo video]

IMU Attitude Estimator — Kalman Filter vs Complementary Filter
  Implemented both algorithms in C++ on STM32, compared accuracy via
  Python visualization. 40% lower RMS error with EKF vs complementary.
  [GitHub link]

Custom Power Distribution Board — KiCad
  Designed 4S LiPo PDB with per-ESC current sensing, regulated 5V/12V
  rails. Fabricated via JLCPCB. Used in full drone build.
  [GitHub link with KiCad files]
```

---

## 8. Industry Sectors — Vietnam Priority Ranking

| Sector | VN Market Size | EE Fit | Entry Point | Who's Hiring |
|---|---|---|---|---|
| **Agriculture** | 🔴 Largest | ⭐⭐⭐⭐ | Spraying drone tech, sensor integration | Viet UAV, Rynan, DJI VN |
| **Mapping & Survey** | 🟠 Large | ⭐⭐⭐⭐ | Photogrammetry pipeline, LiDAR | Navisky, Lat Viet, Vietmap |
| **Defense** | 🟠 Large (state) | ⭐⭐⭐⭐⭐ | Embedded, RF, systems integration | Viettel Aerospace (VTX) |
| **Infrastructure Inspection** | 🟡 Growing | ⭐⭐⭐⭐ | Power line, oil/gas, bridge | EVN contractors, PVN |
| **Media & Tourism** | 🟡 Moderate | ⭐⭐ | Hardware support, gimbal systems | Freelance + agencies |
| **Search & Rescue** | 🟢 Nascent | ⭐⭐⭐ | Real-time systems, thermal | Government, NGOs |
| **Smart City / Telecom** | 🟢 Nascent | ⭐⭐⭐ | 5G relay, network mapping | VNPT, Viettel |

### Vietnam-Specific Sector Deep Dive

#### 🌾 Agriculture — Your Best Entry Point
Vietnam is one of **Asia's top agricultural exporters** (rice, coffee, pepper, shrimp). Drone spraying adoption is growing extremely fast in the Mekong Delta and Central Highlands.

- DJI Agras T40/T50 are the dominant platforms
- Companies need engineers who understand: spray system mechanics, flight path optimization for irregular fields, battery swapping logistics, RTK-GPS for precision
- **Short-term opportunity:** Get DJI Agras certified + build a field data analysis tool → immediately employable

#### 🗺️ Mapping & Survey — Steady Demand
Vietnam has massive ongoing infrastructure (roads, bridges, industrial parks). Survey companies need engineers who can:
- Set up LiDAR pipelines (DJI L2, Livox MID-360)
- Process photogrammetry data (Agisoft Metashape, OpenDroneMap)
- Deliver GIS-ready outputs (orthomosaic, DEM, point clouds)

#### 🛡️ Defense (Viettel Aerospace) — Highest Ceiling
VTX builds Vietnam's most advanced military UAVs. Requires:
- Vietnamese citizenship + security clearance
- Strong embedded systems + RF skills
- Extremely competitive but the best technical environment in VN drone space

> 💡 **Strategy for Vietnam:** Start in **agriculture or mapping** (fastest hiring, build real-world ops experience), then transition to **defense or inspection** once you have 2+ years of hardware + flight operations knowledge.

---

## 9. Open-Source Contributions to Target

Contributing to these projects = free CV line items that hiring managers recognize:

| Project | How to Contribute as EE |
|---|---|
| **PX4-Autopilot** | Hardware support, board bringup, sensor drivers, docs |
| **ArduPilot** | ESC protocols, battery monitoring, peripheral drivers |
| **KiCad** | Symbol/footprint libraries for drone components |
| **Betaflight** | ESC telemetry, motor protocols, filter tuning |
| **OpenDroneMap** | Not EE-specific but useful for portfolio breadth |

Start with **documentation fixes or small driver bugs** — much easier entry point than algorithmic contributions.

---

## 10. Vietnamese Drone Community & Networking

### Local Communities
| Community | Platform | Focus |
|---|---|---|
| **Cộng đồng Drone Việt Nam** | Facebook Group | General, largest VN drone community |
| **FPV Vietnam** | Facebook Group | Racing + freestyle drones, hardware builders |
| **Robotics & AI Vietnam** | Facebook Group | Technical, overlaps with drone autonomy |
| **HCMUT Robotics Club** | Facebook / Discord | Student engineering projects |
| **Viet Maker** | Facebook | Maker culture, embedded systems |

### Key Events & Competitions
| Event | Frequency | Relevance |
|---|---|---|
| **Vietnam Drone Racing Championship** | Annual | Networking + flying skills |
| **AgriTech Vietnam Expo** | Annual (HCM) | Agriculture drone market |
| **CES Asia / Gitex Asia** | Annual (Singapore) | SEA tech industry |
| **ROBOTHON Vietnam** | Annual | Student robotics — enter this |
| **VEX Robotics Vietnam** | Annual | Student competition |

> 💡 **Build your English portfolio first.** When Vietnamese drone companies recruit, they often check GitHub and LinkedIn. An English portfolio signals you can work internationally — which makes you more valuable *even for local roles*.

### Vietnamese LinkedIn/Social Strategy
- Post project updates in **both Vietnamese and English**
- Tag companies like Viettel Technology, Rynan Technologies, FPT
- Follow and engage with CAAV official pages
- LinkedIn is used by recruiters for senior roles; Facebook groups are better for junior/intern hunting in VN

---

## 11. Long-term Career Trajectory (Vietnam Context)

```
PHASE 1 (Year 1–2): Build in Vietnam
  Local role at Rynan / Navisky / Viet UAV
  Salary: 15–25M VND/month
  Goal: Real flight hours, hardware experience, Vietnamese market knowledge

PHASE 2 (Year 2–4): Move Up or Move Out
  Option A — Stay: Viettel Aerospace or senior role at growing startup
             Salary: 30–60M VND/month
  Option B — SEA: Singapore (DSO, ST Engineering) or Thailand/Malaysia
             Salary: SGD 4,000–7,000/month (~$3k–5k)
  Option C — Remote: Work for US/EU drone company remotely
             Salary: $3,000–6,000/month USD

PHASE 3 (Year 4–7): Specialize or Lead
  Technical lead in Vietnam's drone industry
  OR Senior engineer at international company
  OR Found your own drone services company in VN (mapping, inspection)
```

> 🏆 **The founder path is very real in Vietnam.** A drone inspection or agricultural mapping company with solid technical skills and 2–3 enterprise clients can be highly profitable with relatively low competition. Especially in the Mekong Delta.

---

## 12. Resources Summary (Vietnam-Adapted)

| Resource | Link / Access | Priority | Cost |
|---|---|---|---|
| CAAV UAV Regulations | caav.gov.vn | 🔴 Essential | Free |
| PX4 Dev Guide | docs.px4.io | 🔴 Essential | Free |
| ArduPilot Docs | ardupilot.org/dev | 🔴 Essential | Free |
| ROS2 Tutorials | docs.ros.org | 🔴 Essential | Free |
| KiCad Getting Started | docs.kicad.org | 🔴 Essential | Free |
| *Small UAV* — Beard & McLain | Z-Library / purchase | 🔴 Essential | Free–$60 |
| STM32 HAL Docs | st.com | 🟠 Important | Free |
| Gazebo + PX4 SITL | docs.px4.io | 🟠 Important | Free |
| FreeRTOS Tutorials | freertos.org | 🟠 Important | Free |
| MAVLink Dev Guide | mavlink.io/en | 🟠 Important | Free |
| Coursera: Aerial Robotics | coursera.org (apply for aid) | 🟡 Recommended | Free w/ aid |
| FPVDrone.vn (components) | fpvdrone.vn | 🟠 Important | Shopping |
| DJI Agras Operator Cert | enterprise.dji.com | 🟠 Important | Free |

---

*Guide tailored for EE background (≈ 2nd year), Vietnamese/SEA market, March 2026.*
*Salary data in VND based on VN tech market surveys (ITviec, TopDev 2025–2026).*
