/**
 * Post-processing shader definitions for WorldView
 * Three military-style visual filter modes applied via Cesium PostProcessStage.
 *
 * Cesium GLSL convention:
 *   - `uniform sampler2D colorTexture` for the rendered scene
 *   - `in vec2 v_textureCoordinates` for UV coords (0..1)
 *   - `out_FragColor` for output (auto-defined by Cesium)
 */

import { PostProcessStage } from 'cesium';
import type { Viewer as CesiumViewer } from 'cesium';

export type ShaderModeType = 'STANDARD' | 'CRT' | 'NVG' | 'FLIR';

export const SHADER_DEFAULTS = {
  CRT: {
    distortionStrength: 0.1,
    chromaticAberration: 0.003,
    scanlineIntensity: 0.15,
    vignetteStrength: 0.3,
  },
  NVG: {
    brightness: 1.5,
    grainIntensity: 0.08,
    vignetteStrength: 0.5,
    bloomThreshold: 0.7,
  },
  FLIR: {
    contrast: 1.3,
    edgeStrength: 0.5,
    warmTint: 0.1,
  },
};

// ============================================================================
// CRT Monitor Shader
// Barrel distortion, chromatic aberration, scanlines, vignette
// ============================================================================
export const CRT_FRAGMENT_SHADER = `
  uniform sampler2D colorTexture;
  uniform float u_distortionStrength;
  uniform float u_chromaticAberration;
  uniform float u_scanlineIntensity;
  uniform float u_vignetteStrength;
  uniform float u_time;
  in vec2 v_textureCoordinates;

  // Barrel distortion: warp UV coords by distance from center
  vec2 barrelDistortion(vec2 uv, float strength) {
    vec2 centered = uv - 0.5;
    float dist2 = dot(centered, centered);
    // Quadratic distortion: further from center = more warp
    vec2 warped = centered * (1.0 + strength * dist2 + strength * 0.5 * dist2 * dist2);
    return warped + 0.5;
  }

  void main() {
    vec2 uv = v_textureCoordinates;

    // --- Barrel distortion ---
    vec2 distortedUV = barrelDistortion(uv, u_distortionStrength);

    // Discard pixels outside the distorted area (black border)
    if (distortedUV.x < 0.0 || distortedUV.x > 1.0 || distortedUV.y < 0.0 || distortedUV.y > 1.0) {
      out_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // --- Chromatic aberration: offset R/G/B channels ---
    vec2 caOffset = (distortedUV - 0.5) * u_chromaticAberration;
    float r = texture(colorTexture, distortedUV + caOffset).r;
    float g = texture(colorTexture, distortedUV).g;
    float b = texture(colorTexture, distortedUV - caOffset).b;
    vec3 color = vec3(r, g, b);

    // --- Scanlines: sin(uv.y * 800.0) * intensity ---
    float scanline = sin(distortedUV.y * 800.0) * 0.5 + 0.5;
    // Mix scanline darkness with intensity control
    color *= 1.0 - u_scanlineIntensity * (1.0 - scanline);

    // Subtle horizontal line flicker based on time
    float flicker = 1.0 - 0.02 * sin(u_time * 5.0 + distortedUV.y * 50.0);
    color *= flicker;

    // --- Vignette: smoothstep edge darkening ---
    vec2 vigUV = distortedUV - 0.5;
    float vigDist = length(vigUV);
    float vignette = smoothstep(0.7, 0.3, vigDist * (1.0 + u_vignetteStrength));
    color *= vignette;

    // Slight green/amber tint to emulate old CRT phosphor
    color *= vec3(0.95, 1.0, 0.92);

    out_FragColor = vec4(color, 1.0);
  }
`;

// ============================================================================
// Night Vision Goggles (NVG) Shader
// Luminance conversion, green phosphor tint, film grain, tube vignette, bloom
// ============================================================================
export const NVG_FRAGMENT_SHADER = `
  uniform sampler2D colorTexture;
  uniform float u_brightness;
  uniform float u_grainIntensity;
  uniform float u_vignetteStrength;
  uniform float u_bloomThreshold;
  uniform float u_time;
  in vec2 v_textureCoordinates;

  // Pseudo-random hash for film grain
  float random(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = v_textureCoordinates;
    vec4 texColor = texture(colorTexture, uv);

    // --- Luminance conversion via dot product with standard weights ---
    float lum = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

    // --- Additive bloom on bright regions ---
    // Sample surrounding pixels for a simple bloom effect
    float bloomAccum = 0.0;
    float bloomSize = 0.003;
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 offset = vec2(float(x), float(y)) * bloomSize;
        vec3 sampleColor = texture(colorTexture, uv + offset).rgb;
        float sampleLum = dot(sampleColor, vec3(0.299, 0.587, 0.114));
        // Only accumulate from bright regions above threshold
        bloomAccum += max(sampleLum - u_bloomThreshold, 0.0);
      }
    }
    bloomAccum /= 25.0; // Average over 5x5 kernel
    lum += bloomAccum * 2.0; // Additive bloom

    // --- Green phosphor tint: vec3(0.1, 1.0, 0.2) * lum * brightness ---
    vec3 greenPhosphor = vec3(0.1, 1.0, 0.2) * lum * u_brightness;

    // --- Film grain noise overlay ---
    float grain = random(uv * u_time * 0.01 + vec2(u_time * 0.37, u_time * 0.71));
    grain = (grain - 0.5) * u_grainIntensity;
    greenPhosphor += vec3(grain);

    // --- Strong tube vignette effect ---
    vec2 vigUV = uv - 0.5;
    float vigDist = length(vigUV);
    // Strong circular falloff simulating NVG tube
    float vignette = 1.0 - smoothstep(0.2, 0.7, vigDist * (1.0 + u_vignetteStrength));
    // Extra darkening at corners for tube shape
    float tubeMask = 1.0 - smoothstep(0.4, 0.8, vigDist * 1.5);
    vignette *= tubeMask;
    greenPhosphor *= vignette;

    // Clamp to prevent oversaturation
    greenPhosphor = clamp(greenPhosphor, 0.0, 1.0);

    out_FragColor = vec4(greenPhosphor, 1.0);
  }
`;

// ============================================================================
// FLIR Thermal Imaging Shader
// Contrast enhancement, Sobel edge detection, white-hot palette, edge overlay
// ============================================================================
export const FLIR_FRAGMENT_SHADER = `
  uniform sampler2D colorTexture;
  uniform float u_contrast;
  uniform float u_edgeStrength;
  uniform float u_warmTint;
  in vec2 v_textureCoordinates;

  // Get luminance from a texture sample at offset
  float getLum(vec2 uv, vec2 offset) {
    vec3 c = texture(colorTexture, uv + offset).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec2 uv = v_textureCoordinates;
    vec4 texColor = texture(colorTexture, uv);

    // --- Step 1: Luminance ---
    float lum = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

    // --- Step 2: Contrast enhancement ---
    lum = clamp((lum - 0.5) * u_contrast + 0.5, 0.0, 1.0);

    // --- Step 3: Sobel edge detection on neighboring pixel luminance ---
    // Pixel size approximation
    vec2 texel = vec2(1.0 / 1920.0, 1.0 / 1080.0);

    // Sample 3x3 neighborhood luminance
    float tl = getLum(uv, vec2(-texel.x, texel.y));   // top-left
    float tc = getLum(uv, vec2(0.0, texel.y));          // top-center
    float tr = getLum(uv, vec2(texel.x, texel.y));      // top-right
    float ml = getLum(uv, vec2(-texel.x, 0.0));         // mid-left
    float mr = getLum(uv, vec2(texel.x, 0.0));          // mid-right
    float bl = getLum(uv, vec2(-texel.x, -texel.y));    // bottom-left
    float bc = getLum(uv, vec2(0.0, -texel.y));          // bottom-center
    float br = getLum(uv, vec2(texel.x, -texel.y));      // bottom-right

    // Sobel kernels
    float sobelX = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    float sobelY = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
    float edge = sqrt(sobelX * sobelX + sobelY * sobelY);
    edge = clamp(edge * u_edgeStrength, 0.0, 1.0);

    // --- Step 4: White-hot palette (inverted luminance with warm tints for hot spots) ---
    // In white-hot mode: bright areas = hot (white/yellow), dark areas = cold (dark/blue)
    float thermal = lum;

    // Base grayscale (white-hot)
    vec3 palette = vec3(thermal);

    // Add warm tints for hot spots (high luminance)
    // Hot regions get yellow/orange tint
    if (thermal > 0.7) {
      float hotIntensity = (thermal - 0.7) / 0.3;
      palette = mix(palette, vec3(1.0, 0.9, 0.6), hotIntensity * (0.5 + u_warmTint));
    }
    // Very hot regions get pure white/yellow
    if (thermal > 0.85) {
      float veryHot = (thermal - 0.85) / 0.15;
      palette = mix(palette, vec3(1.0, 1.0, 0.8), veryHot * 0.7);
    }
    // Cold regions get slight blue tint
    if (thermal < 0.3) {
      float coldIntensity = (0.3 - thermal) / 0.3;
      palette = mix(palette, vec3(0.1, 0.1, 0.2), coldIntensity * 0.4);
    }

    // --- Step 5: Edge highlighting overlay ---
    // White edges overlaid on thermal image
    palette = mix(palette, vec3(1.0, 1.0, 0.9), edge * 0.8);

    // Slight overall warm tint
    palette *= vec3(1.0, 0.98, 0.95);

    out_FragColor = vec4(clamp(palette, 0.0, 1.0), 1.0);
  }
`;

// ============================================================================
// ShaderManager - Handles cleanup when switching modes
// Removes old PostProcessStage, adds new one
// ============================================================================
export class ShaderManager {
  private currentStage: PostProcessStage | null = null;
  private currentMode: ShaderModeType = 'STANDARD';
  private timeStart: number = Date.now();
  // Guard against concurrent/rapid applyMode calls
  private _applying: boolean = false;

  /**
   * Apply a shader mode to the Cesium viewer.
   * STANDARD mode removes all custom post-processing.
   * Idempotent: calling with the same mode is a no-op.
   * Re-entrant safe: guards against concurrent calls during rapid switching.
   */
  applyMode(viewer: CesiumViewer, mode: ShaderModeType): void {
    if (mode === this.currentMode) return;
    if (this._applying) return; // Prevent re-entrant calls during rapid switching
    this._applying = true;

    try {
      // Remove current post-process stage (and any leaked stages with our names)
      this.removeCurrentStage(viewer);

      this.currentMode = mode;

      // STANDARD mode: just remove, don't add anything
      if (mode === 'STANDARD') return;

      // Create and add the new PostProcessStage
      const stage = this.createStage(mode);
      if (stage) {
        viewer.scene.postProcessStages.add(stage);
        this.currentStage = stage;
      }
    } finally {
      this._applying = false;
    }
  }

  /**
   * Remove the current PostProcessStage from the viewer.
   * Also scans for any leftover WorldView stages to prevent accumulation.
   */
  private removeCurrentStage(viewer: CesiumViewer): void {
    if (viewer.isDestroyed()) return;

    const stages = viewer.scene.postProcessStages;

    // Remove tracked current stage
    if (this.currentStage) {
      try {
        stages.remove(this.currentStage);
      } catch {
        // Stage may already be removed
      }
      this.currentStage = null;
    }

    // Safety sweep: remove any leaked WorldView stages by name
    // This prevents accumulation if a prior remove silently failed
    const stageNames = ['worldview_crt', 'worldview_nvg', 'worldview_flir'];
    for (const name of stageNames) {
      try {
        const leaked = stages.getStageByName(name);
        if (leaked) {
          stages.remove(leaked);
        }
      } catch {
        // Stage may not exist or already be removed
      }
    }
  }

  /**
   * Create a PostProcessStage for the given mode.
   */
  private createStage(mode: ShaderModeType): PostProcessStage | null {
    switch (mode) {
      case 'CRT':
        return new PostProcessStage({
          name: 'worldview_crt',
          fragmentShader: CRT_FRAGMENT_SHADER,
          uniforms: {
            u_distortionStrength: SHADER_DEFAULTS.CRT.distortionStrength,
            u_chromaticAberration: SHADER_DEFAULTS.CRT.chromaticAberration,
            u_scanlineIntensity: SHADER_DEFAULTS.CRT.scanlineIntensity,
            u_vignetteStrength: SHADER_DEFAULTS.CRT.vignetteStrength,
            u_time: () => (Date.now() - this.timeStart) / 1000.0,
          },
        });

      case 'NVG':
        return new PostProcessStage({
          name: 'worldview_nvg',
          fragmentShader: NVG_FRAGMENT_SHADER,
          uniforms: {
            u_brightness: SHADER_DEFAULTS.NVG.brightness,
            u_grainIntensity: SHADER_DEFAULTS.NVG.grainIntensity,
            u_vignetteStrength: SHADER_DEFAULTS.NVG.vignetteStrength,
            u_bloomThreshold: SHADER_DEFAULTS.NVG.bloomThreshold,
            u_time: () => (Date.now() - this.timeStart) / 1000.0,
          },
        });

      case 'FLIR':
        return new PostProcessStage({
          name: 'worldview_flir',
          fragmentShader: FLIR_FRAGMENT_SHADER,
          uniforms: {
            u_contrast: SHADER_DEFAULTS.FLIR.contrast,
            u_edgeStrength: SHADER_DEFAULTS.FLIR.edgeStrength,
            u_warmTint: SHADER_DEFAULTS.FLIR.warmTint,
          },
        });

      default:
        return null;
    }
  }

  /**
   * Get current shader mode.
   */
  getMode(): ShaderModeType {
    return this.currentMode;
  }

  /**
   * Clean up on unmount.
   */
  destroy(viewer: CesiumViewer): void {
    this.removeCurrentStage(viewer);
    this.currentMode = 'STANDARD';
  }
}
