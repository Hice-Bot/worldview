/**
 * Post-processing shader definitions for WorldView
 * Three military-style visual filter modes applied via Cesium PostProcessStage.
 */

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

// TODO: Implement CRT fragment shader (barrel distortion, chromatic aberration, scanlines, vignette)
export const CRT_FRAGMENT_SHADER = `
  // CRT Monitor shader - to be implemented
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;
  void main() {
    out_FragColor = texture(colorTexture, v_textureCoordinates);
  }
`;

// TODO: Implement NVG fragment shader (green phosphor, film grain, tube vignette, bloom)
export const NVG_FRAGMENT_SHADER = `
  // Night Vision Goggles shader - to be implemented
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;
  void main() {
    out_FragColor = texture(colorTexture, v_textureCoordinates);
  }
`;

// TODO: Implement FLIR fragment shader (contrast, Sobel edge detection, white-hot palette)
export const FLIR_FRAGMENT_SHADER = `
  // FLIR Thermal shader - to be implemented
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;
  void main() {
    out_FragColor = texture(colorTexture, v_textureCoordinates);
  }
`;

/**
 * ShaderManager - Handles cleanup when switching modes.
 * Removes old PostProcessStage, adds new one.
 */
export class ShaderManager {
  // TODO: Implement mode switching and cleanup
  // TODO: Remove current PostProcessStage before adding new one
  // TODO: STANDARD mode removes all post-processing
}
