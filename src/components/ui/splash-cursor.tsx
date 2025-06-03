
"use client";
import { useEffect, useRef } from "react";

// Type definitions (adapted from previous working version)
type Pointer = {
  id: number;
  texcoordX: number;
  texcoordY: number;
  prevTexcoordX: number;
  prevTexcoordY: number;
  deltaX: number;
  deltaY: number;
  down: boolean;
  moved: boolean;
  color: { r: number; g: number; b: number };
};

interface GLProgram extends WebGLProgram {
  uniforms?: Record<string, WebGLUniformLocation | null>;
}

interface CustomWebGLRenderingContext extends WebGL2RenderingContext {
    getExtension(extensionName: "EXT_color_buffer_float"): EXT_color_buffer_float | null;
    getExtension(extensionName: "OES_texture_float_linear"): OES_texture_float_linear | null;
    getExtension(extensionName: "OES_texture_half_float"): OES_texture_half_float | null;
    getExtension(extensionName: "OES_texture_half_float_linear"): OES_texture_half_float_linear | null;
    getExtension(extensionName: "WEBGL_lose_context"): WEBGL_lose_context | null;
}

interface WebGLContext {
  gl: CustomWebGLRenderingContext;
  ext: {
    formatRGBA: SupportedFormat | null;
    formatRG: SupportedFormat | null;
    formatR: SupportedFormat | null;
    halfFloatTexType: number | undefined; // GLenum (e.g., gl.HALF_FLOAT or OES_texture_half_float.HALF_FLOAT_OES)
    supportLinearFiltering: OES_texture_float_linear | null;
  };
}

interface SupportedFormat {
  internalFormat: number; // GLenum
  format: number; // GLenum
}

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer | null;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach: (id: number) => number;
  release?: () => void;
}

interface DoubleFBO {
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  read: FBO;
  write: FBO;
  swap: () => void;
  release?: () => void;
}


function SplashCursor({
  SIM_RESOLUTION = 128,
  DYE_RESOLUTION = 1024, // Defaulted to a common working value
  CAPTURE_RESOLUTION = 512,
  DENSITY_DISSIPATION = 1.0,
  VELOCITY_DISSIPATION = 0.5,
  PRESSURE = 0.2,
  PRESSURE_ITERATIONS = 20,
  CURL = 10,
  SPLAT_RADIUS = 0.3,
  SPLAT_FORCE = 6000,
  SHADING = true,
  COLOR_UPDATE_SPEED = 10,
  BACK_COLOR = { r: 0.0, g: 0.0, b: 0.0 },
  TRANSPARENT = true,
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const glContextRef = useRef<WebGLContext | null>(null);
  
  // Store programs and FBOs in refs to persist across re-renders if component structure allowed it
  // For this useEffect-driven component, they are effectively module-level for the effect's scope
  const programsRef = useRef<Record<string, Program | Material | null>>({});
  const fbosRef = useRef<Record<string, FBO | DoubleFBO | undefined>>({});


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Pointer prototype needs to be a constructor function for `new pointerPrototype()`
    const PointerConstructor = function(this: Pointer) {
      this.id = -1;
      this.texcoordX = 0;
      this.texcoordY = 0;
      this.prevTexcoordX = 0;
      this.prevTexcoordY = 0;
      this.deltaX = 0;
      this.deltaY = 0;
      this.down = false;
      this.moved = false;
      this.color = { r: 0, g: 0, b: 0 }; // Changed to object to match usage
    } as any as { new (): Pointer };


    let config = {
      SIM_RESOLUTION, DYE_RESOLUTION, CAPTURE_RESOLUTION, DENSITY_DISSIPATION,
      VELOCITY_DISSIPATION, PRESSURE, PRESSURE_ITERATIONS, CURL, SPLAT_RADIUS,
      SPLAT_FORCE, SHADING, COLOR_UPDATE_SPEED, PAUSED: false, BACK_COLOR, TRANSPARENT,
    };

    let pointers: Pointer[] = [new PointerConstructor()];
    let activePointers: Pointer[] = [];


    const glContextResult = getWebGLContext(canvas);
    if (!glContextResult) {
      console.error("WebGL context initialization failed.");
      return;
    }
    glContextRef.current = glContextResult; // Save to ref if needed elsewhere, though effect encapsulates most
    const { gl, ext } = glContextResult;


    if (ext && !ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 256; // Fallback if linear filtering not supported
      config.SHADING = false;
    }

    function getWebGLContext(canvas: HTMLCanvasElement): WebGLContext | null {
      const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
      let gl = canvas.getContext("webgl2", params) as CustomWebGLRenderingContext | null;
      const isWebGL2 = !!gl;
      if (!isWebGL2) gl = (canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params)) as CustomWebGLRenderingContext | null;
      
      if (!gl) {
        console.error("Failed to get WebGL context.");
        return null;
      }

      let halfFloatExt: OES_texture_half_float | null = null;
      let supportLinearFiltering: OES_texture_float_linear | OES_texture_half_float_linear | null = null;

      if (isWebGL2) {
        gl.getExtension("EXT_color_buffer_float"); // Enable float buffer
        supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
      } else {
        halfFloatExt = gl.getExtension("OES_texture_half_float");
        supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
      }
      
      gl.clearColor(config.BACK_COLOR.r, config.BACK_COLOR.g, config.BACK_COLOR.b, config.TRANSPARENT ? 0.0 : 1.0);

      const halfFloatTexType = isWebGL2 ? (gl as WebGL2RenderingContext).HALF_FLOAT : (halfFloatExt && halfFloatExt.HALF_FLOAT_OES);
      if (!halfFloatTexType) {
         console.warn("Half float texture type not supported. Effects might be limited.");
      }
      
      let formatRGBA: SupportedFormat | null = null;
      let formatRG: SupportedFormat | null = null;
      let formatR: SupportedFormat | null = null;

      if (isWebGL2 && halfFloatTexType) {
        formatRGBA = getSupportedFormat(gl, (gl as WebGL2RenderingContext).RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, (gl as WebGL2RenderingContext).RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, (gl as WebGL2RenderingContext).R16F, gl.RED, halfFloatTexType);
      } else if (halfFloatTexType) { // WebGL1 with half float support
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType); // Fallback for WebGL1
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);  // Fallback for WebGL1
      } else { // No half float support (WebGL1 or WebGL2), try regular floats or unsigned byte as last resort
          console.warn("Half float not available, trying FLOAT or UNSIGNED_BYTE textures.");
          const floatTexType = gl.FLOAT;
          // Try FLOAT first
          formatRGBA = getSupportedFormat(gl, isWebGL2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA, gl.RGBA, floatTexType);
          if(!formatRGBA) { // Fallback to UNSIGNED_BYTE (most compatible)
            console.warn("FLOAT textures not supported, falling back to UNSIGNED_BYTE.");
            const unsignedByteTexType = gl.UNSIGNED_BYTE;
            formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, unsignedByteTexType);
            formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, unsignedByteTexType);
            formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, unsignedByteTexType);
          } else {
             formatRG = getSupportedFormat(gl, isWebGL2 ? (gl as WebGL2RenderingContext).RG32F : gl.RGBA, isWebGL2 ? gl.RG : gl.RGBA, floatTexType);
             formatR = getSupportedFormat(gl, isWebGL2 ? (gl as WebGL2RenderingContext).R32F : gl.RGBA, isWebGL2 ? gl.RED : gl.RGBA, floatTexType);
          }
      }
       if (!formatRGBA || !formatRG || !formatR) {
        console.error("Suitable texture formats not found. Fluid effect may not work correctly.");
        // Provide some default to prevent crashing, though it might not look right
        const fallbackFormat = { internalFormat: gl.RGBA, format: gl.RGBA };
        formatRGBA = formatRGBA || fallbackFormat;
        formatRG = formatRG || fallbackFormat;
        formatR = formatR || fallbackFormat;
      }
      
      return { gl, ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering } };
    }

    function getSupportedFormat(gl: CustomWebGLRenderingContext, internalFormat: number, format: number, type: number | undefined): SupportedFormat | null {
      if (!type || !supportRenderTextureFormat(gl, internalFormat, format, type)) {
        // Fallback logic for unsupported formats
        if (gl.getParameter(gl.VERSION).includes("WebGL 2.0")) { // WebGL2 specific fallbacks
            switch (internalFormat) {
              case (gl as WebGL2RenderingContext).R16F: return getSupportedFormat(gl, (gl as WebGL2RenderingContext).RG16F, gl.RG, type);
              case (gl as WebGL2RenderingContext).RG16F: return getSupportedFormat(gl, (gl as WebGL2RenderingContext).RGBA16F, gl.RGBA, type);
              case (gl as WebGL2RenderingContext).R32F: return getSupportedFormat(gl, (gl as WebGL2RenderingContext).RG32F, gl.RG, type);
              case (gl as WebGL2RenderingContext).RG32F: return getSupportedFormat(gl, (gl as WebGL2RenderingContext).RGBA32F, gl.RGBA, type);
              default: return null;
            }
        } else { // WebGL1 fallbacks (less specific, often default to RGBA)
             return null; // Can't fallback further in a structured way for WebGL1 here easily
        }
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat(gl: CustomWebGLRenderingContext, internalFormat: number, format: number, type: number) {
      const texture = gl.createTexture();
      if (!texture) return false;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      
      const fbo = gl.createFramebuffer();
      if (!fbo) { gl.deleteTexture(texture); return false; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(fbo);
      return status === gl.FRAMEBUFFER_COMPLETE;
    }

    class Material {
      vertexShader: WebGLShader; fragmentShaderSource: string; programs: GLProgram[];
      activeProgram: GLProgram | null; uniforms: Record<string, WebGLUniformLocation | null>;
      constructor(vertexShader: WebGLShader, fragmentShaderSource: string) {
        this.vertexShader = vertexShader; this.fragmentShaderSource = fragmentShaderSource;
        this.programs = []; this.activeProgram = null; this.uniforms = {};
      }
      setKeywords(keywords: string[]) {
        let hash = 0; for (let i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);
        let program = this.programs[hash];
        if (program == null) {
          let fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
          if (!fragmentShader) {
            console.error("Failed to compile fragment shader for Material.");
            return;
          }
          const newProgram = createProgram(this.vertexShader, fragmentShader);
          if (!newProgram) {
             console.error("Failed to create program for Material.");
             return;
          }
          program = newProgram as GLProgram;
          this.programs[hash] = program;
        }
        if (program === this.activeProgram) return;
        if (program) this.uniforms = getUniforms(program);
        this.activeProgram = program;
      }
      bind() { if (this.activeProgram) gl.useProgram(this.activeProgram); }
    }

    class Program {
      uniforms: Record<string, WebGLUniformLocation | null>; program: WebGLProgram | null;
      constructor(vertexShader: WebGLShader, fragmentShader: WebGLShader | null) {
        this.uniforms = {};
        if (fragmentShader) {
          this.program = createProgram(vertexShader, fragmentShader);
          if (this.program) this.uniforms = getUniforms(this.program);
        } else {
           this.program = null; // Handle case where fragment shader fails compilation
        }
      }
      bind() { if (this.program) gl.useProgram(this.program); }
    }

    function createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
      let program = gl.createProgram(); if (!program) { console.error("gl.createProgram failed."); return null; }
      gl.attachShader(program, vertexShader); gl.attachShader(program, fragmentShader); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program linking error:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      return program;
    }

    function getUniforms(program: WebGLProgram): Record<string, WebGLUniformLocation | null> {
      let uniforms: Record<string, WebGLUniformLocation | null> = {};
      let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const uniformInfo = gl.getActiveUniform(program, i);
        if (uniformInfo) uniforms[uniformInfo.name] = gl.getUniformLocation(program, uniformInfo.name);
      }
      return uniforms;
    }

    function compileShader(type: number, source: string, keywords?: string[]): WebGLShader | null {
      source = addKeywords(source, keywords);
      const shader = gl.createShader(type);
      if (!shader) {
        console.error('Failed to create shader object.');
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        console.error(`Shader compilation error for ${shaderType} shader:`);
        console.error(gl.getShaderInfoLog(shader));
        console.error("Problematic shader source:\n", source);
        gl.deleteShader(shader);
        return null; 
      }
      return shader;
    }


    function addKeywords(source: string, keywords?: string[]) {
      if (!keywords || keywords.length === 0) return source; let keywordsString = "";
      keywords.forEach((keyword) => { keywordsString += "#define " + keyword + "\n"; });
      return keywordsString + source;
    }

    const baseVertexShader = compileShader( gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform vec2 texelSize;
        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }`
    );
    const copyShader = compileShader( gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        void main () {
            gl_FragColor = texture2D(uTexture, vUv);
        }`
    );
    const clearShader = compileShader( gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;
        void main () {
            gl_FragColor = value * texture2D(uTexture, vUv);
        }`
    );
    const displayShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform vec2 texelSize;

      vec3 linearToGamma (vec3 color) {
          color = max(color, vec3(0.0));
          return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0.0));
      }

      void main () {
          vec3 c = texture2D(uTexture, vUv).rgb;
          #ifdef SHADING
              vec3 lc = texture2D(uTexture, vL).rgb;
              vec3 rc = texture2D(uTexture, vR).rgb;
              vec3 tc = texture2D(uTexture, vT).rgb;
              vec3 bc = texture2D(uTexture, vB).rgb;
              float dx = length(rc) - length(lc);
              float dy = length(tc) - length(bc);
              vec3 n = normalize(vec3(dx, dy, length(texelSize)));
              vec3 l = vec3(0.0, 0.0, 1.0);
              float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
              c *= diffuse;
          #endif
          float a = max(c.r, max(c.g, c.b));
          gl_FragColor = vec4(c, a);
      }`;

    const splatShader = compileShader( gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;
        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }`
    );
    const advectionShader = compileShader( gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform vec2 dyeTexelSize;
        uniform float dt;
        uniform float dissipation;
        vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
            vec2 st = uv / tsize - 0.5;
            vec2 iuv = floor(st);
            vec2 fuv = fract(st);
            vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
            vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
            vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
            vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
            return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
        }
        void main () {
            #ifdef MANUAL_FILTERING
                vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
                vec4 result = bilerp(uSource, coord, dyeTexelSize);
            #else
                vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
                vec4 result = texture2D(uSource, coord);
            #endif
            float decay = 1.0 + dissipation * dt;
            gl_FragColor = result / decay;
        }`, ext.supportLinearFiltering ? undefined : ["MANUAL_FILTERING"]
    );
    const divergenceShader = compileShader( gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;
            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) { L = -C.x; }
            if (vR.x > 1.0) { R = -C.x; }
            if (vT.y > 1.0) { T = -C.y; }
            if (vB.y < 0.0) { B = -C.y; }
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }`
    );
    const curlShader = compileShader( gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }`
    );
    const vorticityShader = compileShader( gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;
        void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;
            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity += force * dt;
            velocity = min(max(velocity, vec2(-1000.0)), vec2(1000.0));
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }`
    );
    const pressureShader = compileShader( gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            float C = texture2D(uPressure, vUv).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }`
    );
    const gradientSubtractShader = compileShader( gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }`
    );

    if (!baseVertexShader || !copyShader || !clearShader || !splatShader || !advectionShader || !divergenceShader || !curlShader || !vorticityShader || !pressureShader || !gradientSubtractShader) {
      console.error("One or more core shaders failed to compile. Aborting SplashCursor setup."); return;
    }
    
    programsRef.current.copyProgram = new Program(baseVertexShader, copyShader);
    programsRef.current.clearProgram = new Program(baseVertexShader, clearShader);
    programsRef.current.splatProgram = new Program(baseVertexShader, splatShader);
    programsRef.current.advectionProgram = new Program(baseVertexShader, advectionShader);
    programsRef.current.divergenceProgram = new Program(baseVertexShader, divergenceShader);
    programsRef.current.curlProgram = new Program(baseVertexShader, curlShader);
    programsRef.current.vorticityProgram = new Program(baseVertexShader, vorticityShader);
    programsRef.current.pressureProgram = new Program(baseVertexShader, pressureShader);
    programsRef.current.gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);
    programsRef.current.displayMaterial = new Material(baseVertexShader, displayShaderSource);


    const blit = (() => {
      const quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData( gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW );
      const elementBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
      gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW );
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      
      return (target: FBO | null, clear = false) => {
        if (target == null) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) {
          gl.clearColor(config.BACK_COLOR.r, config.BACK_COLOR.g, config.BACK_COLOR.b, config.TRANSPARENT ? 0.0 : 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();
    
    let dye_HELPER: DoubleFBO | undefined, velocity_HELPER: DoubleFBO | undefined, divergence_HELPER: FBO | undefined, curl_HELPER: FBO | undefined, pressure_HELPER: DoubleFBO | undefined;


    function initFramebuffers() {
      let simRes = getResolution(config.SIM_RESOLUTION);
      let dyeRes = getResolution(config.DYE_RESOLUTION);
      const texType = ext.halfFloatTexType || gl.FLOAT; // Fallback to FLOAT if halfFloat not supported
      const rgba = ext.formatRGBA!; // Assume these are non-null after getWebGLContext logic
      const rg = ext.formatRG!;
      const r = ext.formatR!;
      const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);

      dye_HELPER = resizeOrCreateDoubleFBO(dye_HELPER, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      velocity_HELPER = resizeOrCreateDoubleFBO(velocity_HELPER, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      divergence_HELPER = resizeOrCreateFBO(divergence_HELPER, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      curl_HELPER = resizeOrCreateFBO(curl_HELPER, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure_HELPER = resizeOrCreateDoubleFBO(pressure_HELPER, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      
      fbosRef.current.dye = dye_HELPER;
      fbosRef.current.velocity = velocity_HELPER;
      fbosRef.current.divergence = divergence_HELPER;
      fbosRef.current.curl = curl_HELPER;
      fbosRef.current.pressure = pressure_HELPER;
    }
    
    function createFBO(w: number, h: number, internalFormat: number, format: number, type: number, param: number): FBO {
      gl.activeTexture(gl.TEXTURE0); let texture = gl.createTexture() as WebGLTexture;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      let fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture, fbo, width: w, height: h, texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
        attach(id: number) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; },
        release() { gl.deleteTexture(this.texture); gl.deleteFramebuffer(this.fbo); }
      };
    }

    function createDoubleFBO(w: number, h: number, internalFormat: number, format: number, type: number, param: number): DoubleFBO {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w, height: h, texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read() { return fbo1; }, set read(value) { fbo1 = value; },
        get write() { return fbo2; }, set write(value) { fbo2 = value; },
        swap() { let temp = fbo1; fbo1 = fbo2; fbo2 = temp; },
        release() { fbo1.release?.(); fbo2.release?.(); }
      };
    }
    
    function resizeOrCreateFBO(target: FBO | undefined, w: number, h: number, internalFormat: number, format: number, type: number, param: number): FBO {
      if (target && target.width === w && target.height === h) return target;
      target?.release?.();
      return createFBO(w, h, internalFormat, format, type, param);
    }

    function resizeOrCreateDoubleFBO(target: DoubleFBO | undefined, w: number, h: number, internalFormat: number, format: number, type: number, param: number): DoubleFBO {
      if (target && target.width === w && target.height === h) return target;
      target?.release?.();
      return createDoubleFBO(w, h, internalFormat, format, type, param);
    }
    
    function updateKeywords() {
      let displayKeywords = [];
      if (config.SHADING) displayKeywords.push("SHADING");
      (programsRef.current.displayMaterial as Material).setKeywords(displayKeywords);
    }

    updateKeywords();
    initFramebuffers();
    let lastUpdateTime = Date.now();
    let colorUpdateTimer = 0.0;
    let animationLoopRunning = false;

    function updateFrame() {
      const dt = calcDeltaTime();
      if (resizeCanvas()) initFramebuffers();
      updateColors(dt);
      applyInputs();
      if(!config.PAUSED) step(dt);
      render(null);
      if (animationLoopRunning) { // Check flag before requesting next frame
        animationFrameIdRef.current = requestAnimationFrame(updateFrame);
      }
    }

    function calcDeltaTime() { let now = Date.now(); let dt = (now - lastUpdateTime) / 1000; dt = Math.min(dt, 0.016666); lastUpdateTime = now; return dt; }
    function resizeCanvas() {
      if (!canvas) return false;
      let width = scaleByPixelRatio(canvas.clientWidth); let height = scaleByPixelRatio(canvas.clientHeight);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; return true; }
      return false;
    }
    function updateColors(dt: number) {
      if (config.PAUSED) return; colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach((p) => { p.color = generateColor(); });
      }
    }
    function applyInputs() {
      activePointers.forEach(p => {
        if (p.moved) {
          p.moved = false;
          splatPointer(p);
        }
      });
    }

    function step(dt: number) {
      const { velocity, dye, curl, divergence, pressure } = fbosRef.current;
      if (!velocity || !dye || !curl || !divergence || !pressure ) return;

      const curlProgram = programsRef.current.curlProgram as Program;
      const vorticityProgram = programsRef.current.vorticityProgram as Program;
      const divergenceProgram = programsRef.current.divergenceProgram as Program;
      const clearProgram = programsRef.current.clearProgram as Program;
      const pressureProgram = programsRef.current.pressureProgram as Program;
      const gradienSubtractProgram = programsRef.current.gradienSubtractProgram as Program;
      const advectionProgram = programsRef.current.advectionProgram as Program;


      gl.disable(gl.BLEND);
      curlProgram.bind(); gl.uniform2f(curlProgram.uniforms!.texelSize!, (velocity as DoubleFBO).texelSizeX, (velocity as DoubleFBO).texelSizeY); gl.uniform1i(curlProgram.uniforms!.uVelocity!, (velocity as DoubleFBO).read.attach(0)); blit(curl as FBO);
      vorticityProgram.bind(); gl.uniform2f(vorticityProgram.uniforms!.texelSize!, (velocity as DoubleFBO).texelSizeX, (velocity as DoubleFBO).texelSizeY); gl.uniform1i(vorticityProgram.uniforms!.uVelocity!, (velocity as DoubleFBO).read.attach(0)); gl.uniform1i(vorticityProgram.uniforms!.uCurl!, (curl as FBO).attach(1)); gl.uniform1f(vorticityProgram.uniforms!.curl!, config.CURL); gl.uniform1f(vorticityProgram.uniforms!.dt!, dt); blit((velocity as DoubleFBO).write); (velocity as DoubleFBO).swap();
      divergenceProgram.bind(); gl.uniform2f(divergenceProgram.uniforms!.texelSize!, (velocity as DoubleFBO).texelSizeX, (velocity as DoubleFBO).texelSizeY); gl.uniform1i(divergenceProgram.uniforms!.uVelocity!, (velocity as DoubleFBO).read.attach(0)); blit(divergence as FBO);
      clearProgram.bind(); gl.uniform1i(clearProgram.uniforms!.uTexture!, (pressure as DoubleFBO).read.attach(0)); gl.uniform1f(clearProgram.uniforms!.value!, config.PRESSURE); blit((pressure as DoubleFBO).write); (pressure as DoubleFBO).swap();
      pressureProgram.bind(); gl.uniform2f(pressureProgram.uniforms!.texelSize!, (velocity as DoubleFBO).texelSizeX, (velocity as DoubleFBO).texelSizeY); gl.uniform1i(pressureProgram.uniforms!.uDivergence!, (divergence as FBO).attach(0));
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) { gl.uniform1i(pressureProgram.uniforms!.uPressure!, (pressure as DoubleFBO).read.attach(1)); blit((pressure as DoubleFBO).write); (pressure as DoubleFBO).swap(); }
      gradienSubtractProgram.bind(); gl.uniform2f(gradienSubtractProgram.uniforms!.texelSize!, (velocity as DoubleFBO).texelSizeX, (velocity as DoubleFBO).texelSizeY); gl.uniform1i(gradienSubtractProgram.uniforms!.uPressure!, (pressure as DoubleFBO).read.attach(0)); gl.uniform1i(gradienSubtractProgram.uniforms!.uVelocity!, (velocity as DoubleFBO).read.attach(1)); blit((velocity as DoubleFBO).write); (velocity as DoubleFBO).swap();
      advectionProgram.bind(); gl.uniform2f(advectionProgram.uniforms!.texelSize!, (velocity as DoubleFBO).texelSizeX, (velocity as DoubleFBO).texelSizeY);
      if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms!.dyeTexelSize!, (velocity as DoubleFBO).texelSizeX, (velocity as DoubleFBO).texelSizeY);
      let velocityId = (velocity as DoubleFBO).read.attach(0); gl.uniform1i(advectionProgram.uniforms!.uVelocity!, velocityId); gl.uniform1i(advectionProgram.uniforms!.uSource!, velocityId); gl.uniform1f(advectionProgram.uniforms!.dt!, dt); gl.uniform1f(advectionProgram.uniforms!.dissipation!, config.VELOCITY_DISSIPATION); blit((velocity as DoubleFBO).write); (velocity as DoubleFBO).swap();
      if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms!.dyeTexelSize!, (dye as DoubleFBO).texelSizeX, (dye as DoubleFBO).texelSizeY);
      gl.uniform1i(advectionProgram.uniforms!.uVelocity!, (velocity as DoubleFBO).read.attach(0)); gl.uniform1i(advectionProgram.uniforms!.uSource!, (dye as DoubleFBO).read.attach(1)); gl.uniform1f(advectionProgram.uniforms!.dissipation!, config.DENSITY_DISSIPATION); blit((dye as DoubleFBO).write); (dye as DoubleFBO).swap();
    }

    function render(target: FBO | null) {
      const { dye } = fbosRef.current;
      if(!dye) return;

      if (config.TRANSPARENT && !config.PAUSED) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
      else { gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } // Default blend for non-transparent
      gl.enable(gl.BLEND);
      
      const displayMaterial = programsRef.current.displayMaterial as Material;
      displayMaterial.bind();
      if (config.SHADING) gl.uniform2f(displayMaterial.uniforms!.texelSize!, 1.0 / (target?.width ?? gl.drawingBufferWidth), 1.0 / (target?.height ?? gl.drawingBufferHeight));
      gl.uniform1i(displayMaterial.uniforms!.uTexture!, (dye as DoubleFBO).read.attach(0));
      blit(target, config.TRANSPARENT); // Pass clear flag based on transparency
    }


    function splatPointer(pointer: Pointer) { let dx = pointer.deltaX * config.SPLAT_FORCE; let dy = pointer.deltaY * config.SPLAT_FORCE; splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color); }
    
    function clickSplat(pointer: Pointer) {
      const color = generateColor(); // Use the new bright color generation
      // Make initial click splat more vibrant for testing
      let c = {r: color.r * 5, g: color.g * 5, b: color.b * 5}; // Reduced multiplier

      let dx = 100 * (Math.random() - 0.5); let dy = 100 * (Math.random() - 0.5); splat(pointer.texcoordX, pointer.texcoordY, dx, dy, c);
    }

    function splat(x: number, y: number, dx: number, dy: number, color: { r: number, g: number, b: number }) {
      const { velocity, dye } = fbosRef.current;
      const splatProgram = programsRef.current.splatProgram as Program;
      if (!velocity || !dye || !splatProgram || !splatProgram.uniforms) return;
      
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget!, (velocity as DoubleFBO).read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio!, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point!, x, y);
      gl.uniform3f(splatProgram.uniforms.color!, dx, dy, 0.0);
      gl.uniform1f(splatProgram.uniforms.radius!, correctRadius(config.SPLAT_RADIUS / 100.0));
      blit((velocity as DoubleFBO).write); (velocity as DoubleFBO).swap();
      
      gl.uniform1i(splatProgram.uniforms.uTarget!, (dye as DoubleFBO).read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color!, color.r, color.g, color.b);
      blit((dye as DoubleFBO).write); (dye as DoubleFBO).swap();
    }

    function correctRadius(radius: number) { let aspectRatio = canvas.width / canvas.height; if (aspectRatio > 1) radius *= aspectRatio; return radius; }
    
    function updatePointerDownData(pointer: Pointer, id: number, posX: number, posY: number) {
      pointer.id = id; pointer.down = true; pointer.moved = false;
      pointer.texcoordX = posX / canvas.width; pointer.texcoordY = 1.0 - posY / canvas.height;
      pointer.prevTexcoordX = pointer.texcoordX; pointer.prevTexcoordY = pointer.texcoordY;
      pointer.deltaX = 0; pointer.deltaY = 0; pointer.color = generateColor();
    }
    function updatePointerMoveData(pointer: Pointer, posX: number, posY: number) {
      pointer.prevTexcoordX = pointer.texcoordX; pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = posX / canvas.width; pointer.texcoordY = 1.0 - posY / canvas.height;
      pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
      pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
      pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
      // pointer.color is updated by updateColors
    }
    function updatePointerUpData(pointer: Pointer) { pointer.down = false; }

    function correctDeltaX(delta: number) { let aspectRatio = canvas.width / canvas.height; if (aspectRatio < 1) delta *= aspectRatio; return delta; }
    function correctDeltaY(delta: number) { let aspectRatio = canvas.width / canvas.height; if (aspectRatio > 1) delta /= aspectRatio; return delta; }
    
    function generateColor() { // Generates light/bright colors
      const r = 0.8 + Math.random() * 0.2; // 0.8 to 1.0
      const g = 0.8 + Math.random() * 0.2; // 0.8 to 1.0
      const b = 0.8 + Math.random() * 0.2; // 0.8 to 1.0
      return { r, g, b };
    }
    
    function HSVtoRGB(h: number, s: number, v: number) { // Not currently used with generateColor
      let r=0, g=0, b=0, i, f, p, q, t;
      i = Math.floor(h * 6); f = h * 6 - i;
      p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break; case 5: r = v; g = p; b = q; break;
      }
      return { r, g, b };
    }

    function wrap(value: number, min: number, max: number) { const range = max - min; if (range === 0) return min; return ((value - min) % range) + min; }
    function getResolution(resolution: number) {
      let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight; if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      const min = Math.round(resolution); const max = Math.round(resolution * aspectRatio);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
      else return { width: min, height: max };
    }
    function scaleByPixelRatio(input: number) { const pixelRatio = window.devicePixelRatio || 1; return Math.floor(input * pixelRatio); }
    function hashCode(s: string) { if (s.length === 0) return 0; let hash = 0; for (let i = 0; i < s.length; i++) { hash = (hash << 5) - hash + s.charCodeAt(i); hash |= 0; } return hash; }

    const startAnimationLoop = () => {
        if (!animationLoopRunning) {
            animationLoopRunning = true;
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
            updateFrame();
        }
    };
    
    const getPointer = (id: number): Pointer => {
        let pointer = activePointers.find(p => p.id === id);
        if (!pointer) {
            pointer = new PointerConstructor();
            activePointers.push(pointer);
        }
        return pointer;
    };


    const handleMouseDown = (e: MouseEvent) => { startAnimationLoop(); let p = getPointer(-1); updatePointerDownData(p, -1, scaleByPixelRatio(e.clientX), scaleByPixelRatio(e.clientY)); clickSplat(p); };
    const handleMouseMove = (e: MouseEvent) => { startAnimationLoop(); let p = getPointer(-1); if(p.down) updatePointerMoveData(p, scaleByPixelRatio(e.clientX), scaleByPixelRatio(e.clientY)); };
    const handleMouseUp = (e: MouseEvent) => { let p = getPointer(-1); updatePointerUpData(p); };
    
    const handleTouchStart = (e: TouchEvent) => { startAnimationLoop(); e.preventDefault(); const touches = e.targetTouches; for (let i = 0; i < touches.length; i++) { let p = getPointer(touches[i].identifier); updatePointerDownData(p, touches[i].identifier, scaleByPixelRatio(touches[i].clientX), scaleByPixelRatio(touches[i].clientY)); clickSplat(p); } };
    const handleTouchMove = (e: TouchEvent) => { startAnimationLoop(); e.preventDefault(); const touches = e.targetTouches; for (let i = 0; i < touches.length; i++) { let p = getPointer(touches[i].identifier); updatePointerMoveData(p, scaleByPixelRatio(touches[i].clientX), scaleByPixelRatio(touches[i].clientY)); } };
    const handleTouchEnd = (e: TouchEvent) => { const touches = e.changedTouches; for (let i = 0; i < touches.length; i++) { let p = getPointer(touches[i].identifier); updatePointerUpData(p); activePointers = activePointers.filter(ap => ap.id !== p.id); } };


    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd); // Also handle touchcancel

    startAnimationLoop(); // Start animation loop on mount if not already running due to interaction.

    return () => {
      animationLoopRunning = false; // Stop the loop
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);

      Object.values(fbosRef.current).forEach(fbo => fbo?.release?.());
      fbosRef.current = {};
      
      dye_HELPER?.release?.();
      velocity_HELPER?.release?.();
      divergence_HELPER?.release?.();
      curl_HELPER?.release?.();
      pressure_HELPER?.release?.();

      Object.values(programsRef.current).forEach(p => {
        if (p && 'program' in p && p.program) gl.deleteProgram(p.program);
        else if (p && 'activeProgram' in p && p.activeProgram) gl.deleteProgram(p.activeProgram);
      });
      programsRef.current = {};

      if (baseVertexShader) gl.deleteShader(baseVertexShader);
      if (copyShader) gl.deleteShader(copyShader);
      if (clearShader) gl.deleteShader(clearShader);
      if (splatShader) gl.deleteShader(splatShader);
      if (advectionShader) gl.deleteShader(advectionShader);
      if (divergenceShader) gl.deleteShader(divergenceShader);
      if (curlShader) gl.deleteShader(curlShader);
      if (vorticityShader) gl.deleteShader(vorticityShader);
      if (pressureShader) gl.deleteShader(pressureShader);
      if (gradientSubtractShader) gl.deleteShader(gradientSubtractShader);
      
      const loseContextExt = glContextRef.current?.gl.getExtension('WEBGL_lose_context');
      if (loseContextExt) loseContextExt.loseContext();
      glContextRef.current = null;
    };
  }, [ SIM_RESOLUTION, DYE_RESOLUTION, CAPTURE_RESOLUTION, DENSITY_DISSIPATION, VELOCITY_DISSIPATION, PRESSURE, PRESSURE_ITERATIONS, CURL, SPLAT_RADIUS, SPLAT_FORCE, SHADING, COLOR_UPDATE_SPEED, BACK_COLOR, TRANSPARENT ]);

  return (
    <div className="fixed top-0 left-0 z-[-10] pointer-events-none mix-blend-screen">
      <canvas ref={canvasRef} id="fluid" className="w-screen h-screen" />
    </div>
  );
}

export { SplashCursor };

    