// web/webgl_renderer.js
// Renderizador WebGL com shaders GLSL: Pixel-Perfect e CRT Retrô

export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { alpha: false, preserveDrawingBuffer: false, antialias: false });
    if (!this.gl) {
      throw new Error("WebGL não suportado pelo navegador.");
    }

    const gl = this.gl;
    this.width = 256;
    this.height = 240;
    this.pixelData = new Uint8Array(this.width * this.height * 4);
    this.shaderMode = "crisp"; // "crisp" ou "crt"

    this.initShaders();
    this.initBuffers();
    this.initTexture();
  }

  initShaders() {
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Shader Crisp (Pixel Perfect)
    const fsCrispSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `;

    // Shader CRT Scanlines Flat (Sem curvatura redonda)
    const fsCrtSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv = v_texCoord;
        vec4 color = texture2D(u_texture, uv);

        // Scanlines horizontais
        float scanline = sin(uv.y * 240.0 * 3.14159) * 0.12;
        color.rgb -= scanline;

        // Grade de fósforo suave
        float mask = fract(gl_FragCoord.x * 0.5) > 0.5 ? 0.98 : 1.02;
        color.rgb *= mask;

        gl_FragColor = vec4(color.rgb, 1.0);
      }
    `;
    this.programCrisp = this.createProgram(vsSource, fsCrispSource);
    this.programCrt = this.createProgram(vsSource, fsCrtSource);
    this.currentProgram = this.shaderMode === "crt" ? this.programCrt : this.programCrisp;
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Erro compilando shader: " + err);
    }
    return shader;
  }

  createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Erro no link do programa WebGL: " + gl.getProgramInfoLog(program));
    }
    return program;
  }

  initBuffers() {
    const gl = this.gl;
    const vertices = new Float32Array([
      // X, Y,   U, V
      -1, -1,   0, 1,
       1, -1,   1, 1,
      -1,  1,   0, 0,
      -1,  1,   0, 0,
       1, -1,   1, 1,
       1,  1,   1, 0,
    ]);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  initTexture() {
    const gl = this.gl;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Aloca buffer da textura uma única vez no início
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  setShaderMode(mode) {
    this.shaderMode = mode;
    this.currentProgram = mode === "crt" ? this.programCrt : this.programCrisp;
  }

  render(pixelBuffer) {
    const gl = this.gl;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.currentProgram);

    // Atualiza textura WebGL via texSubImage2D (sem re-alocação de memória na GPU)
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixelBuffer
    );

    // Bind vertices e coordenadas de textura
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const posLoc = gl.getAttribLocation(this.currentProgram, "a_position");
    const texLoc = gl.getAttribLocation(this.currentProgram, "a_texCoord");

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
