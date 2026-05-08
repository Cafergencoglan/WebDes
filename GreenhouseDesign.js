/**
 * SERA PROJESİ - YAPISAL TASARIM HESAPLAYICI
 * Beşik çatı metalden sera (100m x 12m)
 * Canlı Yük: 100 kg
 * Kar Yükü: 75 kg
 * Rüzgar Hızı: 12 m/s
 */

class GreenhouseDesign {
  constructor(length, width, roofAngle = 30) {
    // Sera Boyutları (m)
    this.length = length;           // Uzunluk
    this.width = width;             // Genişlik
    this.roofAngle = roofAngle;     // Çatı açısı (derece)
    
    // Yükler (kg)
    this.liveLoad = 0;              // Canlı yük
    this.snowLoad = 0;              // Kar yükü
    this.windSpeed = 0;             // Rüzgar hızı (m/s)
    
    // Malzeme Özellikleri
    this.steelYield = 250;          // Çeliğin akma dayanımı (MPa)
    this.steelDensity = 7850;       // Çeliğin yoğunluğu (kg/m³)
    this.airDensity = 1.225;        // Havanın yoğunluğu (kg/m³)
    this.gravity = 9.81;            // Yerçekimi ivmesi (m/s²)
  }

  /**
   * Yükleri Belirleme
   */
  setLoads(liveLoad, snowLoad, windSpeed) {
    this.liveLoad = liveLoad;
    this.snowLoad = snowLoad;
    this.windSpeed = windSpeed;
  }

  /**
   * Rüzgar Basıncı Hesaplama (Pascal)
   * P = 0.5 * ρ * v²
   */
  calculateWindPressure() {
    const pressure = 0.5 * this.airDensity * this.windSpeed * this.windSpeed;
    return pressure;
  }

  /**
   * Beşik Çatı Yüzey Alanı (m²)
   * Beşik çatı: 2 × (uzunluk × çatı_genişliği)
   */
  calculateSurfaceArea() {
    const angleRad = (this.roofAngle * Math.PI) / 180;
    const roofWidth = this.width / (2 * Math.cos(angleRad));
    const roofArea = 2 * this.length * roofWidth;
    return roofArea;
  }

  /**
   * Çatıya Etki Eden Toplam Yük (kN)
   */
  calculateTotalLoad() {
    const platformArea = this.length * this.width;
    
    // Canlı yük: dağıtılmış yük (kN/m²)
    const liveLoadDistributed = (this.liveLoad * this.gravity) / platformArea / 1000;
    
    // Kar yükü: dağıtılmış yük (kN/m²)
    const snowLoadDistributed = (this.snowLoad * this.gravity) / platformArea / 1000;
    
    // Rüzgar basıncı → kuvvete dönüştürme (kPa)
    const windPressure = this.calculateWindPressure(); // Pa
    const windLoad = windPressure / 1000; // kPa

    console.log('\n' + '='.repeat(50));
    console.log('SERA YAPISI YÜKLER ANALİZİ');
    console.log('='.repeat(50));
    console.log(`Canlı Yük (Dağıtılmış): ${liveLoadDistributed.toFixed(4)} kN/m²`);
    console.log(`Kar Yükü (Dağıtılmış): ${snowLoadDistributed.toFixed(4)} kN/m²`);
    console.log(`Rüzgar Basıncı: ${windLoad.toFixed(4)} kPa`);

    // Toplam yük (Güvenlik faktörü uygulanmamış)
    const totalLoad = (liveLoadDistributed + snowLoadDistributed + windLoad) * platformArea;
    console.log(`Toplam Yük: ${totalLoad.toFixed(3)} kN`);
    
    return totalLoad;
  }

  /**
   * Gerekli Çelik Profil Kesit Alanı (cm²)
   */
  calculateRequiredSteelArea() {
    const totalLoad = this.calculateTotalLoad();
    const safetyFactor = 1.5; // Güvenlik faktörü
    const allowableStress = this.steelYield / safetyFactor; // MPa

    // Gerekli kesit alanı = Kuvvet / Basınç
    // 1 kN = 1000 N, 1 MPa = 1 N/mm²
    let requiredArea = (totalLoad * 1000000) / allowableStress; // mm²
    requiredArea = requiredArea / 100; // cm² ye çevir

    console.log('\n' + '='.repeat(50));
    console.log('ÇELIK PROFİL HESAPLARI');
    console.log('='.repeat(50));
    console.log(`Akma Dayanımı (fy): ${this.steelYield} MPa`);
    console.log(`Güvenlik Faktörü: ${safetyFactor}`);
    console.log(`İzin Verilen Gerilme: ${allowableStress.toFixed(2)} MPa`);
    console.log(`Gerekli Kesit Alanı: ${requiredArea.toFixed(2)} cm²`);

    // Standart profil önerileri
    this.recommendSteelProfile(requiredArea);

    return requiredArea;
  }

  /**
   * Standart Çelik Profil Önerileri
   */
  recommendSteelProfile(requiredArea) {
    const profiles = [
      { name: 'IPE 200', area: 28.5 },
      { name: 'IPE 240', area: 39.1 },
      { name: 'IPE 270', area: 45.9 },
      { name: 'IPE 300', area: 53.8 },
      { name: 'IPE 330', area: 62.6 },
      { name: 'IPE 360', area: 72.7 },
      { name: 'HEB 200', area: 78.0 },
      { name: 'HEB 240', area: 106.0 },
      { name: 'HEB 300', area: 149.0 }
    ];

    const suitable = profiles.filter(p => p.area >= requiredArea);
    if (suitable.length > 0) {
      console.log('\nÖnerilen Standart Profiller:');
      suitable.slice(0, 3).forEach(profile => {
        console.log(`  • ${profile.name}: ${profile.area} cm²`);
      });
    }
  }

  /**
   * Seranın Ağırlığı (Metal Yapı)
   */
  calculateStructuralWeight() {
    const surfaceArea = this.calculateSurfaceArea();
    // Metal çerçeve (yaklaşık): 50 kg/m²
    const frameWeight = surfaceArea * 50; // kg

    console.log('\n' + '='.repeat(50));
    console.log('YAPININ AĞIRLIĞı');
    console.log('='.repeat(50));
    console.log(`Çatı Yüzey Alanı: ${surfaceArea.toFixed(2)} m²`);
    console.log(`Metal Çerçeve Ağırlığı: ${frameWeight.toFixed(2)} kg`);
    console.log(`Metal Çerçeve Ağırlığı: ${(frameWeight / 1000).toFixed(3)} ton`);

    return frameWeight;
  }

  /**
   * Rüzgar Kuvveti (Newton)
   */
  calculateWindForce() {
    const surfaceArea = this.calculateSurfaceArea();
    const windPressure = this.calculateWindPressure(); // Pa
    const windForce = windPressure * surfaceArea; // N

    console.log('\n' + '='.repeat(50));
    console.log('RÜZGAR ANALİZİ');
    console.log('='.repeat(50));
    console.log(`Rüzgar Hızı: ${this.windSpeed} m/s`);
    console.log(`Rüzgar Basıncı: ${windPressure.toFixed(3)} Pa`);
    console.log(`Çatıya Etki Eden Rüzgar Kuvveti: ${(windForce / 1000).toFixed(2)} kN`);

    return windForce;
  }

  /**
   * Temel Boyutlandırması (cm)
   */
  calculateFoundation() {
    const totalLoad = this.calculateTotalLoad();
    const structureWeight = this.calculateStructuralWeight();
    const totalForce = (totalLoad * 1000 + (structureWeight * this.gravity) / 1000); // kN

    // Zemin taşıma kapasitesi: 2-3 kg/cm² (orta zemin)
    const soilCapacity = 2.5 * 10; // kPa

    const foundationArea = (totalForce * 1000) / soilCapacity; // cm²
    const foundationSide = Math.sqrt(foundationArea); // cm (kare temel)
    const foundationDepth = Math.max(100, foundationSide / 2); // En az 1m derinlik

    console.log('\n' + '='.repeat(50));
    console.log('TEMEL TASARIMI');
    console.log('='.repeat(50));
    console.log(`Toplam Tasarım Yükü: ${totalForce.toFixed(2)} kN`);
    console.log(`Zemin Taşıma Kapasitesi: ${soilCapacity} kPa`);
    console.log(`Gerekli Temel Alanı: ${foundationArea.toFixed(2)} cm²`);
    console.log(`Kare Temel Kenarı: ${foundationSide.toFixed(2)} cm (${(foundationSide / 100).toFixed(2)} m)`);
    console.log(`Temel Derinliği: ${(foundationDepth / 100).toFixed(2)} m`);
  }

  /**
   * Tam Rapor Oluşturma
   */
  generateDesignReport() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║      SERA PROJESİ - YAPISAL TASARIM RAPORU            ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    console.log('\n' + '='.repeat(50));
    console.log('GİRİŞ VERİLERİ');
    console.log('='.repeat(50));
    console.log(`Sera Uzunluğu: ${this.length} m`);
    console.log(`Sera Genişliği: ${this.width} m`);
    console.log(`Sera Alanı: ${this.length * this.width} m²`);
    console.log(`Çatı Açısı: ${this.roofAngle}°`);
    console.log(`Canlı Yük: ${this.liveLoad} kg`);
    console.log(`Kar Yükü: ${this.snowLoad} kg`);
    console.log(`Rüzgar Hızı: ${this.windSpeed} m/s`);
    console.log(`Malzeme: Çelik (fy = ${this.steelYield} MPa)`);

    // Tüm hesaplamaları çalıştır
    this.calculateTotalLoad();
    this.calculateRequiredSteelArea();
    this.calculateStructuralWeight();
    this.calculateWindForce();
    this.calculateFoundation();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    RAPOR SONU                         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
  }

  /**
   * JSON Formatında Sonuçları Döndürme
   */
  getResultsAsJSON() {
    return {
      dimensions: {
        length: this.length,
        width: this.width,
        area: this.length * this.width,
        roofAngle: this.roofAngle
      },
      loads: {
        liveLoad: this.liveLoad,
        snowLoad: this.snowLoad,
        windSpeed: this.windSpeed
      },
      calculations: {
        surfaceArea: this.calculateSurfaceArea(),
        windPressure: this.calculateWindPressure(),
        totalLoad: this.calculateTotalLoad(),
        structuralWeight: this.calculateStructuralWeight(),
        windForce: this.calculateWindForce()
      }
    };
  }
}

// ============================================
// MAIN - Ana Program
// ============================================

// Sera Tasarımı Oluşturma (100m x 12m, 30° çatı açısı)
const greenhouse = new GreenhouseDesign(100, 12, 30);

// Yükleri Belirleme
greenhouse.setLoads(100, 75, 12); // canlı yük, kar yükü, rüzgar hızı

// Tasarım Raporunu Oluşturma
greenhouse.generateDesignReport();

// Opsiyonel: JSON formatında sonuçları alma
const results = greenhouse.getResultsAsJSON();
console.log('\n📊 JSON SONUÇLARI:');
console.log(JSON.stringify(results, null, 2));

// Node.js modülü olarak dışarıya aktarma
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GreenhouseDesign;
}
