/**
 * LittleJS Post Processing Plugin (ESM-compatible)
 * ------------------------------------------------
 * Shadertoy-style post-processing pass for LittleJS.
 * Works in Vite + ESM builds (no missing exports).
 */

'use strict';

import {
  engineAddPlugin,
  glContext,
  glEnable,
  glCreateTexture,
  glCreateProgram,
  glGeometryBuffer,
  glCanvas,
  glFlush,
  mainCanvas,
  time,
} from 'littlejsengine';

// Local safe fallbacks
function ASSERT(cond, msg) {
  if (!cond) throw new Error('ASSERT failed: ' + (msg || ''));
}
function LOG(msg) {
  console.log(msg);
}

let postProcess;

class PostProcessPlugin {
  /**
   * Create a global post-processing shader.
   * @param {string} shaderCode - GLSL implementing mainImage().
   * @param {boolean} [includeMainCanvas] - Optional extra copy step (unused in ESM).
   * @param {boolean} [feedbackTexture] - Use previous frame as texture.
   */
  constructor(shaderCode, includeMainCanvas = false, feedbackTexture = false) {
    ASSERT(!postProcess, 'Post process already initialized');
    ASSERT(!(includeMainCanvas && feedbackTexture),
      'Post process cannot both include main canvas and use feedback texture');

    postProcess = this;

    if (!shaderCode)
      shaderCode = 'void mainImage(out vec4 c,vec2 p){c=texture(iChannel0,p/iResolution.xy);}';

    this.shader  = undefined;
    this.texture = undefined;
    this.vao     = undefined;

    initPostProcess();
    engineAddPlugin(undefined, postProcessRender, postProcessContextLost, postProcessContextRestored);

    // ─────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────
    function initPostProcess() {
      if (!glEnable) {
        console.warn('PostProcessPlugin: WebGL not enabled!');
        return;
      }

      postProcess.texture = glCreateTexture();
      postProcess.shader = glCreateProgram(
        // vertex shader
        `#version 300 es
         precision highp float;
         in vec2 p;
         void main() { gl_Position = vec4(p + p - 1., 1., 1.); }`,
        // fragment shader
        `#version 300 es
         precision highp float;
         uniform sampler2D iChannel0;
         uniform vec3 iResolution;
         uniform float iTime;
         out vec4 c;
         ${shaderCode}
         void main() {
           mainImage(c, gl_FragCoord.xy);
           c.a = 1.;
         }`
      );

      postProcess.vao = glContext.createVertexArray();
      glContext.bindVertexArray(postProcess.vao);
      glContext.bindBuffer(glContext.ARRAY_BUFFER, glGeometryBuffer);

      const stride = 8;
      const pLoc = glContext.getAttribLocation(postProcess.shader, 'p');
      glContext.enableVertexAttribArray(pLoc);
      glContext.vertexAttribPointer(pLoc, 2, glContext.FLOAT, false, stride, 0);
    }

    function postProcessContextLost() {
      postProcess.shader = undefined;
      postProcess.texture = undefined;
      LOG('PostProcessPlugin: WebGL context lost');
    }

    function postProcessContextRestored() {
      initPostProcess();
      LOG('PostProcessPlugin: WebGL context restored');
    }

    function postProcessRender() {
      if (!glEnable) return;

      glFlush();
      glContext.useProgram(postProcess.shader);
      glContext.bindVertexArray(postProcess.vao);
      glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);
      glContext.disable(glContext.BLEND);

      // Copy from glCanvas (LittleJS internal framebuffer)
      glContext.activeTexture(glContext.TEXTURE0);
      glContext.bindTexture(glContext.TEXTURE_2D, postProcess.texture);
      glContext.texImage2D(
        glContext.TEXTURE_2D,
        0,
        glContext.RGBA,
        glContext.RGBA,
        glContext.UNSIGNED_BYTE,
        glCanvas
      );

      // Set uniforms and draw
      const loc = (n) => glContext.getUniformLocation(postProcess.shader, n);
      glContext.uniform1i(loc('iChannel0'), 0);
      glContext.uniform1f(loc('iTime'), time);
      glContext.uniform3f(loc('iResolution'), mainCanvas.width, mainCanvas.height, 1);
      glContext.drawArrays(glContext.TRIANGLE_STRIP, 0, 4);
    }
  }
}

export { PostProcessPlugin };
