// Extended WebXR type declarations for Depth Sensing (LiDAR) API
// Covers W3C WebXR Depth Sensing Module

interface XRDepthInformationBase {
  readonly width: number;
  readonly height: number;
  readonly normDepthBufferFromNormView: XRRigidTransform;
  readonly rawValueToMeters: number;
}

interface XRCPUDepthInformation extends XRDepthInformationBase {
  readonly data: ArrayBuffer;
  getDepthInMeters(x: number, y: number): number;
}

interface XRWebGLDepthInformation extends XRDepthInformationBase {
  readonly texture: WebGLTexture;
}

interface XRDepthSensingInit {
  usagePreference: ('cpu-optimized' | 'gpu-optimized')[];
  dataFormatPreference: ('luminance-alpha' | 'float32')[];
}

interface XRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
  depthSensing?: XRDepthSensingInit;
  domOverlay?: { root: Element };
}

interface XRFrame {
  getDepthInformation(view: XRView): XRCPUDepthInformation | null;
  getHitTestResults(hitTestSource: XRHitTestSource): XRHitTestResult[];
  getHitTestResultsForTransientInput(
    hitTestSource: XRTransientInputHitTestSource
  ): XRTransientInputHitTestResult[];
  getLightEstimate(lightProbe: XRLightProbe): XRLightEstimate | null;
}

interface XRSession {
  requestHitTestSource(options: {
    space: XRSpace;
    entityTypes?: string[];
    offsetRay?: XRRay;
  }): Promise<XRHitTestSource>;
  requestLightProbe(options?: { reflectionFormat?: string }): Promise<XRLightProbe>;
  readonly domOverlayState?: { type: string };
  readonly depthUsage?: string;
  readonly depthDataFormat?: string;
}

interface XRHitTestSource {
  cancel(): void;
}

interface XRHitTestResult {
  getPose(baseSpace: XRSpace): XRPose | null;
  createAnchor?(): Promise<XRAnchor>;
}

interface XRTransientInputHitTestSource {
  cancel(): void;
}

interface XRTransientInputHitTestResult {
  readonly inputSource: XRInputSource;
  readonly results: XRHitTestResult[];
}

interface XRLightProbe extends EventTarget {
  readonly probeSpace: XRSpace;
}

interface XRLightEstimate {
  readonly sphericalHarmonicsCoefficients: Float32Array;
  readonly primaryLightDirection: DOMPointReadOnly;
  readonly primaryLightIntensity: DOMPointReadOnly;
}

interface XRAnchor {
  readonly anchorSpace: XRSpace;
  delete(): void;
}

interface XRRay {
  readonly origin: DOMPointReadOnly;
  readonly direction: DOMPointReadOnly;
  readonly matrix: Float32Array;
}

declare class XRRay {
  constructor(origin?: DOMPointInit, direction?: DOMPointInit);
  constructor(transform?: XRRigidTransform);
}
