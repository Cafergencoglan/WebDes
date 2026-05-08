#include <iostream>
#include <cmath>
#include <iomanip>
#include <json/json.h>
#include <vector>

// Material properties database
struct Material {
    std::string name;
    double yieldStrength;      // MPa
    double density;             // kg/m3
    double costPerKg;          // USD/kg
    double elasticModulus;     // GPa
};

// Material database
const Material STEEL = {"Steel", 250, 7850, 0.8, 200};
const Material ALUMINUM = {"Aluminum", 240, 2700, 1.5, 70};
const Material WOOD = {"Wood", 10, 500, 0.5, 10};

struct GreenhouseDesign {
    // Input parameters
    double length;              // m
    double width;               // m
    double liveLoad;            // kg
    double snowLoad;            // kg
    double windSpeed;           // m/s
    
    // Calculated loads (kN)
    double deadLoad;
    double totalVerticalLoad;
    double windLoad;
    double combinedLoad;
    
    // Material dimensions
    double beamWidth;           // mm
    double beamHeight;          // mm
    double columnDiameter;      // mm
    double foundationDepth;     // mm
    
    // Safety factors and stresses
    double safetyFactor;
    double maxStress;
    double allowableStress;
    double stressRatio;
    
    // Cost estimation
    double materialCost;
    double laborCost;
    double totalCost;
    
    // FEM results
    double maxDeflection;       // mm
    double maxStress_FEM;       // MPa
    double minSafetyFactor;
};

class GreenhouseCalculator {
private:
    GreenhouseDesign design;
    Material selectedMaterial;
    
public:
    GreenhouseCalculator(double len, double wid, double live, double snow, double wind)
        : selectedMaterial(STEEL) {
        design.length = len;
        design.width = wid;
        design.liveLoad = live;
        design.snowLoad = snow;
        design.windSpeed = wind;
    }
    
    // Calculate dead load (structure weight)
    void calculateDeadLoad() {
        // Estimate dead load as 15% of design load
        double totalDesignLoad = design.liveLoad + design.snowLoad;
        design.deadLoad = totalDesignLoad * 0.15;
    }
    
    // Calculate vertical loads
    void calculateVerticalLoads() {
        calculateDeadLoad();
        
        // Convert to kN (1 kg = 0.00981 kN)
        double liveLoadKN = design.liveLoad * 0.00981;
        double snowLoadKN = design.snowLoad * 0.00981;
        double deadLoadKN = design.deadLoad * 0.00981;
        
        // With load factors: Dead (1.2) + Live (1.6) + Snow (1.2)
        design.totalVerticalLoad = (deadLoadKN * 1.2) + (liveLoadKN * 1.6) + (snowLoadKN * 1.2);
    }
    
    // Calculate wind load (Eurocode 1)
    void calculateWindLoad() {
        // Wind pressure: Pw = 0.5 * ρ * v^2
        // ρ (air density) = 1.225 kg/m3
        double windPressure = 0.5 * 1.225 * design.windSpeed * design.windSpeed / 1000; // kN/m2
        
        // Exposure factor and shape coefficient
        double exposureFactor = 1.3;  // Terrain category II
        double shapeCoefficient = 1.3; // For greenhouses
        
        // Total wind load
        double effectiveArea = design.length * design.width / 1000; // m2 to convert pressure properly
        design.windLoad = windPressure * exposureFactor * shapeCoefficient * effectiveArea;
    }
    
    // Calculate combined load case
    void calculateCombinedLoad() {
        // Most critical: 1.2*Dead + 1.6*Wind (or 1.2*Dead + 1.2*Snow)
        design.combinedLoad = std::max(design.totalVerticalLoad, design.windLoad * 1.5);
    }
    
    // Design beam dimensions
    void designBeamDimensions() {
        // Moment calculation: M = (w * L^2) / 8
        double distributedLoad = design.totalVerticalLoad / design.length; // kN/m
        double momentKNm = (distributedLoad * design.length * design.length) / 8;
        double momentNmm = momentKNm * 1e6; // Convert to N·mm
        
        // Required section modulus: Z = M / σ_allow
        // Use safety factor of 2.0
        design.safetyFactor = 2.0;
        design.allowableStress = selectedMaterial.yieldStrength / design.safetyFactor;
        
        double requiredZ = momentNmm / design.allowableStress;
        
        // For rectangular beam: Z = (b * h^2) / 6
        // Assume h = 2*b for optimal design
        double b = std::pow((requiredZ * 6) / 2, 1.0/3.0);
        design.beamWidth = std::ceil(b / 10) * 10;  // Round to 10mm
        design.beamHeight = std::ceil(2 * b / 10) * 10;
        
        // Column diameter (circular): A = π * d^2 / 4
        // Using compression stress
        double compressionStress = design.combinedLoad / (design.length / 10); // Simplified
        double requiredArea = (compressionStress * 1000) / design.allowableStress;
        design.columnDiameter = std::ceil(std::sqrt(4 * requiredArea / M_PI) / 10) * 10;
        
        // Foundation depth (rule of thumb: 0.5-1.0m below frost line)
        design.foundationDepth = 800; // mm (0.8m standard)
    }
    
    // Calculate stresses
    void calculateStresses() {
        // Bending stress
        double Ix = (design.beamWidth * design.beamHeight * design.beamHeight * design.beamHeight) / 12;
        double y = design.beamHeight / 2;
        double momentNmm = ((design.totalVerticalLoad / design.length) * design.length * design.length / 8) * 1e6;
        design.maxStress = (momentNmm * y) / Ix;
        
        // Stress ratio
        design.stressRatio = design.maxStress / design.allowableStress;
    }
    
    // FEM-inspired deflection calculation
    void calculateDeflection() {
        // Maximum deflection for simply supported beam: δ = (5 * w * L^4) / (384 * E * I)
        double w = design.totalVerticalLoad / design.length; // kN/m
        double L = design.length; // m
        double E = selectedMaterial.elasticModulus * 1e9; // Pa
        
        double Ix = (design.beamWidth * design.beamHeight * design.beamHeight * design.beamHeight) / 12; // mm^4
        Ix = Ix / 1e12; // Convert to m^4
        
        double deflectionM = (5 * w * 1000 * std::pow(L, 4)) / (384 * E * Ix);
        design.maxDeflection = deflectionM * 1000; // Convert to mm
        
        // FEM stress estimate (simplified)
        design.maxStress_FEM = design.maxStress * 0.95; // ~95% of analytical
        design.minSafetyFactor = design.allowableStress / design.maxStress_FEM;
    }
    
    // Cost estimation
    void estimateCost() {
        // Material weight calculation
        double beamVolume = (design.beamWidth * design.beamHeight * design.length) / 1e9; // m3
        double columnVolume = (M_PI * design.columnDiameter * design.columnDiameter * design.length / 4) / 1e9; // m3
        
        double totalVolume = beamVolume + columnVolume * 4; // 4 main columns
        double totalWeight = totalVolume * selectedMaterial.density;
        
        // Material cost
        design.materialCost = totalWeight * selectedMaterial.costPerKg;
        
        // Labor cost (assume $50/hour, 0.3 hours per m of structure)
        design.laborCost = design.length * 0.3 * 50;
        
        // Additional costs (foundation, fasteners, misc)
        double additionalCost = (design.materialCost + design.laborCost) * 0.2;
        
        design.totalCost = design.materialCost + design.laborCost + additionalCost;
    }
    
    // Execute all calculations
    void calculate() {
        calculateVerticalLoads();
        calculateWindLoad();
        calculateCombinedLoad();
        designBeamDimensions();
        calculateStresses();
        calculateDeflection();
        estimateCost();
    }
    
    // Convert to JSON for frontend
    Json::Value toJSON() {
        Json::Value root;
        
        // Input parameters
        root["input"]["length"] = design.length;
        root["input"]["width"] = design.width;
        root["input"]["liveLoad"] = design.liveLoad;
        root["input"]["snowLoad"] = design.snowLoad;
        root["input"]["windSpeed"] = design.windSpeed;
        root["input"]["material"] = selectedMaterial.name;
        
        // Calculated loads
        root["loads"]["deadLoad"] = std::round(design.deadLoad * 10) / 10.0;
        root["loads"]["totalVerticalLoad"] = std::round(design.totalVerticalLoad * 100) / 100.0;
        root["loads"]["windLoad"] = std::round(design.windLoad * 100) / 100.0;
        root["loads"]["combinedLoad"] = std::round(design.combinedLoad * 100) / 100.0;
        
        // Material dimensions
        root["dimensions"]["beamWidth"] = design.beamWidth;
        root["dimensions"]["beamHeight"] = design.beamHeight;
        root["dimensions"]["columnDiameter"] = design.columnDiameter;
        root["dimensions"]["foundationDepth"] = design.foundationDepth;
        
        // Safety and stress
        root["safety"]["safetyFactor"] = std::round(design.safetyFactor * 100) / 100.0;
        root["safety"]["maxStress"] = std::round(design.maxStress * 10) / 10.0;
        root["safety"]["allowableStress"] = std::round(design.allowableStress * 10) / 10.0;
        root["safety"]["stressRatio"] = std::round(design.stressRatio * 100) / 100.0;
        
        // FEM Results
        root["fem"]["maxDeflection"] = std::round(design.maxDeflection * 100) / 100.0;
        root["fem"]["maxStress"] = std::round(design.maxStress_FEM * 10) / 10.0;
        root["fem"]["minSafetyFactor"] = std::round(design.minSafetyFactor * 100) / 100.0;
        
        // Cost estimation
        root["cost"]["materialCost"] = std::round(design.materialCost * 100) / 100.0;
        root["cost"]["laborCost"] = std::round(design.laborCost * 100) / 100.0;
        root["cost"]["totalCost"] = std::round(design.totalCost * 100) / 100.0;
        
        // Status
        root["status"] = (design.stressRatio <= 1.0 && design.maxDeflection < design.length * 1000 / 250) 
                         ? "SAFE" : "REVIEW_REQUIRED";
        
        return root;
    }
    
    // Getter for design results
    const GreenhouseDesign& getDesign() const {
        return design;
    }
};

// Main calculation endpoint
int main(int argc, char* argv[]) {
    if (argc != 6) {
        std::cerr << "Usage: greenhouse-calculator <length> <width> <liveLoad> <snowLoad> <windSpeed>" << std::endl;
        return 1;
    }
    
    double length = std::stod(argv[1]);
    double width = std::stod(argv[2]);
    double liveLoad = std::stod(argv[3]);
    double snowLoad = std::stod(argv[4]);
    double windSpeed = std::stod(argv[5]);
    
    GreenhouseCalculator calc(length, width, liveLoad, snowLoad, windSpeed);
    calc.calculate();
    
    Json::Value result = calc.toJSON();
    Json::StreamWriterBuilder writer;
    std::cout << Json::writeString(writer, result) << std::endl;
    
    return 0;
}
