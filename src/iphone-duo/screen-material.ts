import { Matrix4, ShaderMaterial, Vector2 } from 'three'

export function createScreenMaterial(cover: boolean) {
  return new ShaderMaterial({
    uniforms: {
      bodyInverse: { value: new Matrix4() },
      screenMap: { value: undefined },
      overlayMap: { value: undefined },
      hasOverlay: { value: 0 },
      revealMap: { value: undefined },
      hasReveal: { value: 0 },
      resolution: { value: new Vector2(1600, 1200) },
      progress: { value: 0 },
      focusEdge: { value: cover ? 1.25 : 0.5 },
      defocus: { value: 1 },
      blur: { value: 28 },
      parallax: { value: 1 },
      cover: { value: cover ? 1 : 0 },
      mediaScale: { value: 1 },
      mediaOffset: { value: new Vector2(0, 0) },
      mediaRotation: { value: new Vector2(0, 0) },
      mediaFitAspect: { value: 0 },
    },
    vertexShader: `
      uniform mat4 bodyInverse;
      varying vec2 screenUv;
      varying vec3 displayPosition;
      varying vec3 displayCamera;
      varying vec3 coverStart;
      varying vec3 coverEnd;
      void main() {
        displayPosition = (bodyInverse * modelMatrix * vec4(position, 1.0)).xyz;
        displayCamera = (bodyInverse * vec4(cameraPosition, 1.0)).xyz;
        coverStart = (bodyInverse * modelMatrix * vec4(-0.233961, 0.0, -0.524105, 1.0)).xyz;
        coverEnd = (bodyInverse * modelMatrix * vec4(-7.973315, 0.0, -0.524105, 1.0)).xyz;
        screenUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D screenMap;
      uniform sampler2D overlayMap;
      uniform float hasOverlay;
      uniform sampler2D revealMap;
      uniform float hasReveal;
      uniform float parallax;
      uniform vec2 resolution;
      uniform float progress;
      uniform float focusEdge;
      uniform float defocus;
      uniform float blur;
      uniform float cover;
      uniform float mediaScale;
      uniform vec2 mediaOffset;
      uniform vec2 mediaRotation;
      uniform float mediaFitAspect;
      varying vec2 screenUv;
      varying vec3 displayPosition;
      varying vec3 displayCamera;
      varying vec3 coverStart;
      varying vec3 coverEnd;

      vec4 sampleLayer(sampler2D layer, vec2 uv, float lod) {
        return mix(texture2D(layer, uv), textureLod(layer, uv, lod), smoothstep(0.0, 1.0, lod));
      }

      vec2 rotateMediaUv(vec2 centeredUv, float targetAspect) {
        float rx = radians(mediaRotation.x);
        float ry = radians(mediaRotation.y);
        float sx = sin(rx);
        float cx = cos(rx);
        float sy = sin(ry);
        float cy = cos(ry);
        float perspectiveDistance = 2.4;

        mat3 homography = mat3(
          perspectiveDistance * cy, 0.0, sy,
          perspectiveDistance * sy * sx, perspectiveDistance * cx, -cy * sx,
          0.0, 0.0, perspectiveDistance
        );

        vec2 planePoint = vec2(centeredUv.x * targetAspect, centeredUv.y);
        vec3 sourcePoint = inverse(homography) * vec3(planePoint, 1.0);
        float safeDepth = abs(sourcePoint.z) < 0.0001 ? 0.0001 : sourcePoint.z;
        vec2 sourcePlane = sourcePoint.xy / safeDepth;
        return vec2(sourcePlane.x / targetAspect, sourcePlane.y);
      }

      vec4 sampleScreen(vec2 uv, float lod) {
        float safeScale = max(mediaScale, 0.001);
        float targetAspect = mix(15.798708 / 11.10349, 7.739354 / 11.251288, cover);
        vec2 centeredUv = uv - 0.5 - mediaOffset;
        centeredUv = rotateMediaUv(centeredUv, targetAspect);
        vec2 backgroundUv;

        if (mediaFitAspect > 0.5) {
          float sourceAspect = max(resolution.x / max(resolution.y, 1.0), 0.001);
          vec2 fitSize = sourceAspect > targetAspect
            ? vec2(1.0, targetAspect / sourceAspect)
            : vec2(sourceAspect / targetAspect, 1.0);
          vec2 displaySize = fitSize * safeScale;
          backgroundUv = centeredUv / displaySize + 0.5;
        } else {
          backgroundUv = centeredUv * 0.97 / safeScale + 0.5;
        }

        float backgroundInside = step(0.0, backgroundUv.x) * step(backgroundUv.x, 1.0) * step(0.0, backgroundUv.y) * step(backgroundUv.y, 1.0);
        vec4 backgroundSample = sampleLayer(screenMap, clamp(backgroundUv, vec2(0.001), vec2(0.999)), lod);
        vec4 background = mix(vec4(0.0, 0.0, 0.0, 1.0), backgroundSample, backgroundInside);

        vec2 revealUv = uv;
        vec4 reveal = sampleLayer(revealMap, clamp(revealUv, vec2(0.001), vec2(0.999)), lod);
        float revealInside = step(0.0, revealUv.x) * step(revealUv.x, 1.0) * step(0.0, revealUv.y) * step(revealUv.y, 1.0);
        background.rgb = mix(background.rgb, reveal.rgb, reveal.a * hasReveal * revealInside);

        vec2 contentUv = uv;
        vec4 content = sampleLayer(overlayMap, clamp(contentUv, vec2(0.001), vec2(0.999)), lod);
        float inside = step(0.0, contentUv.x) * step(contentUv.x, 1.0) * step(0.0, contentUv.y) * step(contentUv.y, 1.0);
        return vec4(mix(background.rgb, content.rgb, content.a * hasOverlay * inside), 1.0);
      }

      void main() {
        vec3 ray = displayPosition - displayCamera;
        float rayDepth = min(ray.z, -0.001);
        vec3 intersection = displayCamera + ray * (-displayCamera.z / rayDepth);
        vec2 planeUv = vec2(intersection.x / mix(15.798708, 7.739354, cover) + 0.5 * (1.0 - cover), intersection.y / mix(11.10349, 11.251288, cover) + 0.5);
        vec3 startRay = coverStart - displayCamera;
        vec3 endRay = coverEnd - displayCamera;
        float startX = displayCamera.x - startRay.x * displayCamera.z / min(startRay.z, -0.001);
        float endX = displayCamera.x - endRay.x * displayCamera.z / min(endRay.z, -0.001);
        if (cover > 0.5) {
          float span = endX - startX;
          planeUv.x = abs(span) > 0.001 ? (intersection.x - startX) / span : screenUv.x;
        }
        float projection = mix((1.0 - smoothstep(0.18, 0.5, screenUv.x)) * (1.0 - smoothstep(0.9, 1.0, progress)), smoothstep(0.0, 0.08, progress), cover);
        vec2 projectedUv = mix(screenUv, planeUv, clamp(parallax, 0.0, 1.0) * projection);
        float coverage = smoothstep(-0.01, 0.018, projectedUv.x) * (1.0 - smoothstep(0.982, 1.01, projectedUv.x));
        coverage = mix(coverage, 1.0, cover);
        coverage *= smoothstep(-0.035, 0.015, projectedUv.y) * (1.0 - smoothstep(0.985, 1.035, projectedUv.y));
        float coverWave = smoothstep(focusEdge - 0.2, focusEdge + 0.18, screenUv.x);
        float innerWave = defocus * (1.0 - smoothstep(0.2, 0.49, screenUv.x));
        float amount = mix(innerWave, coverWave, cover);
        float radius = blur * amount * mix(3.5, 1.8, cover);
        float lod = max(0.0, log2(max(1.0, radius / 3.0)));
        vec4 color = sampleScreen(projectedUv, lod);
        float weight = 1.0;
        for (int i = 1; i <= 4; i++) {
          float f = float(i);
          float distance = sqrt(f / 4.0);
          float angle = f * 2.399963;
          vec2 offset = vec2(cos(angle), sin(angle)) * distance * radius * 0.35 / resolution;
          float w = exp(-distance * distance * 2.0);
          color += sampleScreen(clamp(projectedUv + offset, vec2(0.001), vec2(0.999)), lod) * w;
          weight += w;
        }
        color /= weight;
        float foldShade = sin(progress * 3.14159265);
        float innerShade = foldShade * 0.18 * (1.0 - smoothstep(0.3, 0.5, screenUv.x));
        float coverShade = foldShade * 0.52 * smoothstep(0.05, 0.95, screenUv.x);
        color.rgb *= mix(1.0, coverage, projection) * (1.0 - mix(innerShade, coverShade, cover));
        gl_FragColor = color;
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
  })
}
