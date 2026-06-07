import * as Kalidokit from "../dist";
//Import Helper Functions from Kalidokit
const remap = Kalidokit.Utils.remap;
const clamp = Kalidokit.Utils.clamp;
const lerp = Kalidokit.Vector.lerp;

/* THREEJS WORLD SETUP */
let currentVrm;

// Cutout Setup
let cutoutPlanes = {
    eyeL: null,
    eyeR: null,
    mouth: null,
};
let cutoutTextures = {
    eyeL: null,
    eyeR: null,
    mouth: null,
};
const cutoutSettings = {
    enabled: false,
    leX: 0.1, leY: 0,
    reX: -0.1, reY: 0,
    mX: 0, mY: -0.15,
    zOffset: 0.1,
    scale: 0.5
};

// renderer
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// camera
const orbitCamera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
orbitCamera.position.set(0.0, 1.4, 0.7);

// controls
const orbitControls = new THREE.OrbitControls(orbitCamera, renderer.domElement);
orbitControls.screenSpacePanning = true;
orbitControls.target.set(0.0, 1.4, 0.0);
orbitControls.update();

// scene
const scene = new THREE.Scene();

// light
const light = new THREE.DirectionalLight(0xffffff);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);

// Main Render Loop
const clock = new THREE.Clock();

let selectedPlane = null;
const tmpVec = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function animate() {
    requestAnimationFrame(animate);

    if (currentVrm) {
        // Update model to render physics
        currentVrm.update(clock.getDelta());
    }
    renderer.render(scene, orbitCamera);
    
    // Feature 1: Update Gizmo Overlay
    if (typeof updateGizmoOverlay === "function") {
        updateGizmoOverlay();
    }
}
animate();

/* VRM CHARACTER SETUP */

// Import Character VRM
const loader = new THREE.GLTFLoader();
loader.crossOrigin = "anonymous";

// Helper function to load VRM
const loadVRM = (url) => {
    loader.load(
        url,
        (gltf) => {
            THREE.VRMUtils.removeUnnecessaryJoints(gltf.scene);

            THREE.VRM.from(gltf).then((vrm) => {
                if (currentVrm) {
                    scene.remove(currentVrm.scene);
                }
                scene.add(vrm.scene);
                currentVrm = vrm;
                currentVrm.scene.rotation.y = Math.PI; // Rotate model 180deg to face camera

                // Add Cutout Planes to Head Bone
                const headBone = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Head);
                if (headBone) {
                    createCutoutPlanes(headBone);
                }
            });
        },

        (progress) => console.log("Loading model...", 100.0 * (progress.loaded / progress.total), "%"),

        (error) => console.error(error)
    );
};

// Import model from URL, add your own model here
loadVRM("https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm?v=1630342336981");

// Handle VRM File Upload
const vrmUpload = document.getElementById("vrm-upload");
vrmUpload.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    const url = URL.createObjectURL(file);
    loadVRM(url);
});

// Face Cutout UI Handlers
const togglePanel = document.getElementById("toggle-panel");
const sidePanel = document.getElementById("side-panel");
togglePanel.addEventListener("click", () => sidePanel.classList.toggle("open"));

const updateSettings = () => {
    cutoutSettings.enabled = document.getElementById("enable-cutout").checked;
    // X/Y settings are now managed by the gizmo, but we still need to read other settings
    const zOffsetEl = document.getElementById("z-offset");
    const scaleEl = document.getElementById("cutout-scale");
    if (zOffsetEl) cutoutSettings.zOffset = parseFloat(zOffsetEl.value);
    if (scaleEl) cutoutSettings.scale = parseFloat(scaleEl.value);

    if (cutoutPlanes.eyeL) {
        cutoutPlanes.eyeL.visible = cutoutSettings.enabled;
        cutoutPlanes.eyeR.visible = cutoutSettings.enabled;
        cutoutPlanes.mouth.visible = cutoutSettings.enabled;

        cutoutPlanes.eyeL.position.set(cutoutSettings.leX, cutoutSettings.leY, cutoutSettings.zOffset);
        cutoutPlanes.eyeR.position.set(cutoutSettings.reX, cutoutSettings.reY, cutoutSettings.zOffset);
        cutoutPlanes.mouth.position.set(cutoutSettings.mX, cutoutSettings.mY, cutoutSettings.zOffset);

        const s = cutoutSettings.scale;
        cutoutPlanes.eyeL.scale.set(s, s, s);
        cutoutPlanes.eyeR.scale.set(s, s, s);
        cutoutPlanes.mouth.scale.set(s, s, s);
    }

    // Feature 3: Background logic (Fixed)
    const bgEnableEl = document.getElementById("bg-solid-enable");
    const bgColorEl = document.getElementById("bg-color-picker");
    if (bgEnableEl && bgColorEl) {
        if (bgEnableEl.checked) {
            const color = new THREE.Color(bgColorEl.value);
            scene.background = color;
            renderer.setClearColor(color, 1);
            renderer.domElement.style.background = 'transparent';
            document.body.style.background = 'transparent';
        } else {
            scene.background = null;
            renderer.setClearColor(0x000000, 0);
            renderer.domElement.style.background = '';
            document.body.style.background = '';
        }
    }

    // Redraw Gizmo
    if (typeof drawGizmo === "function") drawGizmo();
};

document.querySelectorAll(".side-panel input").forEach(el => el.addEventListener("input", updateSettings));

const createCutoutPlanes = (headBone) => {
    const canvases = {
        eyeL: document.getElementById("eye-l-canvas"),
        eyeR: document.getElementById("eye-r-canvas"),
        mouth: document.getElementById("mouth-canvas")
    };

    Object.keys(canvases).forEach(key => {
        const texture = new THREE.CanvasTexture(canvases[key]);
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const geometry = new THREE.PlaneGeometry(0.2, key === "mouth" ? 0.15 : 0.1);
        const plane = new THREE.Mesh(geometry, material);

        headBone.add(plane);
        cutoutPlanes[key] = plane;
        cutoutTextures[key] = texture;
    });
    updateSettings();
};

// Animate Rotation Helper function
const rigRotation = (name, rotation = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 0.3) => {
    if (!currentVrm) {
        return;
    }
    const Part = currentVrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName[name]);
    if (!Part) {
        return;
    }

    let euler = new THREE.Euler(
        rotation.x * dampener,
        rotation.y * dampener,
        rotation.z * dampener,
        rotation.rotationOrder || "XYZ"
    );
    let quaternion = new THREE.Quaternion().setFromEuler(euler);
    Part.quaternion.slerp(quaternion, lerpAmount); // interpolate
};

// Animate Position Helper Function
const rigPosition = (name, position = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 0.3) => {
    if (!currentVrm) {
        return;
    }
    const Part = currentVrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName[name]);
    if (!Part) {
        return;
    }
    let vector = new THREE.Vector3(position.x * dampener, position.y * dampener, position.z * dampener);
    Part.position.lerp(vector, lerpAmount); // interpolate
};

let oldLookTarget = new THREE.Euler();
const rigFace = (riggedFace) => {
    if (!currentVrm) {
        return;
    }
    rigRotation("Neck", riggedFace.head, 0.7);

    // Blendshapes and Preset Name Schema
    const Blendshape = currentVrm.blendShapeProxy;
    const PresetName = THREE.VRMSchema.BlendShapePresetName;

    // Simple example without winking. Interpolate based on old blendshape, then stabilize blink with `Kalidokit` helper function.
    // for VRM, 1 is closed, 0 is open.
    riggedFace.eye.l = lerp(clamp(1 - riggedFace.eye.l, 0, 1), Blendshape.getValue(PresetName.Blink), 0.5);
    riggedFace.eye.r = lerp(clamp(1 - riggedFace.eye.r, 0, 1), Blendshape.getValue(PresetName.Blink), 0.5);
    riggedFace.eye = Kalidokit.Face.stabilizeBlink(riggedFace.eye, riggedFace.head.y);
    Blendshape.setValue(PresetName.Blink, riggedFace.eye.l);

    // Interpolate and set mouth blendshapes
    Blendshape.setValue(PresetName.I, lerp(riggedFace.mouth.shape.I, Blendshape.getValue(PresetName.I), 0.5));
    Blendshape.setValue(PresetName.A, lerp(riggedFace.mouth.shape.A, Blendshape.getValue(PresetName.A), 0.5));
    Blendshape.setValue(PresetName.E, lerp(riggedFace.mouth.shape.E, Blendshape.getValue(PresetName.E), 0.5));
    Blendshape.setValue(PresetName.O, lerp(riggedFace.mouth.shape.O, Blendshape.getValue(PresetName.O), 0.5));
    Blendshape.setValue(PresetName.U, lerp(riggedFace.mouth.shape.U, Blendshape.getValue(PresetName.U), 0.5));

    //PUPILS
    //interpolate pupil and keep a copy of the value
    let lookTarget = new THREE.Euler(
        lerp(oldLookTarget.x, riggedFace.pupil.y, 0.4),
        lerp(oldLookTarget.y, riggedFace.pupil.x, 0.4),
        0,
        "XYZ"
    );
    oldLookTarget.copy(lookTarget);
    currentVrm.lookAt.applyer.lookAt(lookTarget);
};

const updateCutouts = (landmarks, resultImage) => {
    if (!cutoutSettings.enabled || !landmarks) return;

    // prefer results.image (actual processed frame), fall back to videoElement
    const imageSource =
        resultImage &&
        (resultImage instanceof HTMLVideoElement ||
            resultImage instanceof HTMLCanvasElement ||
            resultImage instanceof ImageBitmap ||
            resultImage instanceof HTMLImageElement)
            ? resultImage
            : videoElement;

    const sourceWidth = imageSource.videoWidth || imageSource.width;
    const sourceHeight = imageSource.videoHeight || imageSource.height;
    if (!sourceWidth || !sourceHeight) return;

    // landmarks are normalized [0,1] — multiply by source dimensions directly
    const getBoundingBox = (indices, padding = 0.1) => {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        indices.forEach((idx) => {
            const lm = landmarks[idx];
            if (!lm) return;
            if (lm.x < minX) minX = lm.x;
            if (lm.y < minY) minY = lm.y;
            if (lm.x > maxX) maxX = lm.x;
            if (lm.y > maxY) maxY = lm.y;
        });
        if (minX === Infinity) return null;
        const w = maxX - minX;
        const h = maxY - minY;
        return {
            x: Math.max(0, (minX - w * padding) * sourceWidth),
            y: Math.max(0, (minY - h * padding) * sourceHeight),
            width: Math.min(sourceWidth, w * (1 + padding * 2) * sourceWidth),
            height: Math.min(sourceHeight, h * (1 + padding * 2) * sourceHeight),
        };
    };

    // Fix 3: use correct landmark indices matching Kalidokit source
    const eyeLIndices = [130, 133, 160, 159, 158, 144, 145, 153];
    const eyeRIndices = [263, 362, 387, 386, 385, 373, 374, 380];
    const mouthIndices = [61, 291, 13, 14, 0, 17, 78, 308];

    const boxes = {
        eyeL: getBoundingBox(eyeLIndices, 0.5),
        eyeR: getBoundingBox(eyeRIndices, 0.5),
        mouth: getBoundingBox(mouthIndices, 0.35),
    };

    const canvasIds = { eyeL: "eye-l-canvas", eyeR: "eye-r-canvas", mouth: "mouth-canvas" };

    Object.keys(boxes).forEach((key) => {
        const box = boxes[key];
        if (!box || box.width <= 0 || box.height <= 0) return;

        const canvas = document.getElementById(canvasIds[key]);
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        try {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imageSource, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height);
            
            // Feature 1: Apply Mask
            if (maskCanvases && maskCanvases[key]) {
                ctx.globalCompositeOperation = "destination-in";
                ctx.drawImage(maskCanvases[key], 0, 0);
                ctx.globalCompositeOperation = "source-over";
            }
        } catch (e) {
            console.warn("drawImage failed for", key, e);
        }

        if (cutoutTextures[key]) cutoutTextures[key].needsUpdate = true;
    });
};

/* VRM Character Animator */
const animateVRM = (vrm, results, faceLandmarkSnapshot) => {
    if (!vrm) {
        return;
    }
    // Take the results from `Holistic` and animate character based on its Face, Pose, and Hand Keypoints.
    let riggedPose, riggedLeftHand, riggedRightHand, riggedFace;

    const faceLandmarks = results.faceLandmarks;
    // Pose 3D Landmarks are with respect to Hip distance in meters
    const pose3DLandmarks = results.ea;
    // Pose 2D landmarks are with respect to videoWidth and videoHeight
    const pose2DLandmarks = results.poseLandmarks;
    // Be careful, hand landmarks may be reversed
    const leftHandLandmarks = results.rightHandLandmarks;
    const rightHandLandmarks = results.leftHandLandmarks;

    // Animate Face
    if (faceLandmarks) {
        riggedFace = Kalidokit.Face.solve(faceLandmarks, {
            runtime: "mediapipe",
            video: videoElement,
        });
        rigFace(riggedFace);
        updateCutouts(faceLandmarkSnapshot, results.image);
    }

    // Animate Pose
    if (pose2DLandmarks && pose3DLandmarks) {
        riggedPose = Kalidokit.Pose.solve(pose3DLandmarks, pose2DLandmarks, {
            runtime: "mediapipe",
            video: videoElement,
        });
        rigRotation("Hips", riggedPose.Hips.rotation, 0.7);
        rigPosition(
            "Hips",
            {
                x: riggedPose.Hips.position.x, // Reverse direction
                y: riggedPose.Hips.position.y + 1, // Add a bit of height
                z: -riggedPose.Hips.position.z, // Reverse direction
            },
            1,
            0.07
        );

        rigRotation("Chest", riggedPose.Spine, 0.25, 0.3);
        rigRotation("Spine", riggedPose.Spine, 0.45, 0.3);

        rigRotation("RightUpperArm", riggedPose.RightUpperArm, 1, 0.3);
        rigRotation("RightLowerArm", riggedPose.RightLowerArm, 1, 0.3);
        rigRotation("LeftUpperArm", riggedPose.LeftUpperArm, 1, 0.3);
        rigRotation("LeftLowerArm", riggedPose.LeftLowerArm, 1, 0.3);

        rigRotation("LeftUpperLeg", riggedPose.LeftUpperLeg, 1, 0.3);
        rigRotation("LeftLowerLeg", riggedPose.LeftLowerLeg, 1, 0.3);
        rigRotation("RightUpperLeg", riggedPose.RightUpperLeg, 1, 0.3);
        rigRotation("RightLowerLeg", riggedPose.RightLowerLeg, 1, 0.3);
    }

    // Animate Hands
    if (leftHandLandmarks) {
        riggedLeftHand = Kalidokit.Hand.solve(leftHandLandmarks, "Left");
        rigRotation("LeftHand", {
            // Combine pose rotation Z and hand rotation X Y
            z: riggedPose.LeftHand.z,
            y: riggedLeftHand.LeftWrist.y,
            x: riggedLeftHand.LeftWrist.x,
        });
        rigRotation("LeftRingProximal", riggedLeftHand.LeftRingProximal);
        rigRotation("LeftRingIntermediate", riggedLeftHand.LeftRingIntermediate);
        rigRotation("LeftRingDistal", riggedLeftHand.LeftRingDistal);
        rigRotation("LeftIndexProximal", riggedLeftHand.LeftIndexProximal);
        rigRotation("LeftIndexIntermediate", riggedLeftHand.LeftIndexIntermediate);
        rigRotation("LeftIndexDistal", riggedLeftHand.LeftIndexDistal);
        rigRotation("LeftMiddleProximal", riggedLeftHand.LeftMiddleProximal);
        rigRotation("LeftMiddleIntermediate", riggedLeftHand.LeftMiddleIntermediate);
        rigRotation("LeftMiddleDistal", riggedLeftHand.LeftMiddleDistal);
        rigRotation("LeftThumbProximal", riggedLeftHand.LeftThumbProximal);
        rigRotation("LeftThumbIntermediate", riggedLeftHand.LeftThumbIntermediate);
        rigRotation("LeftThumbDistal", riggedLeftHand.LeftThumbDistal);
        rigRotation("LeftLittleProximal", riggedLeftHand.LeftLittleProximal);
        rigRotation("LeftLittleIntermediate", riggedLeftHand.LeftLittleIntermediate);
        rigRotation("LeftLittleDistal", riggedLeftHand.LeftLittleDistal);
    }
    if (rightHandLandmarks) {
        riggedRightHand = Kalidokit.Hand.solve(rightHandLandmarks, "Right");
        rigRotation("RightHand", {
            // Combine Z axis from pose hand and X/Y axis from hand wrist rotation
            z: riggedPose.RightHand.z,
            y: riggedRightHand.RightWrist.y,
            x: riggedRightHand.RightWrist.x,
        });
        rigRotation("RightRingProximal", riggedRightHand.RightRingProximal);
        rigRotation("RightRingIntermediate", riggedRightHand.RightRingIntermediate);
        rigRotation("RightRingDistal", riggedRightHand.RightRingDistal);
        rigRotation("RightIndexProximal", riggedRightHand.RightIndexProximal);
        rigRotation("RightIndexIntermediate", riggedRightHand.RightIndexIntermediate);
        rigRotation("RightIndexDistal", riggedRightHand.RightIndexDistal);
        rigRotation("RightMiddleProximal", riggedRightHand.RightMiddleProximal);
        rigRotation("RightMiddleIntermediate", riggedRightHand.RightMiddleIntermediate);
        rigRotation("RightMiddleDistal", riggedRightHand.RightMiddleDistal);
        rigRotation("RightThumbProximal", riggedRightHand.RightThumbProximal);
        rigRotation("RightThumbIntermediate", riggedRightHand.RightThumbIntermediate);
        rigRotation("RightThumbDistal", riggedRightHand.RightThumbDistal);
        rigRotation("RightLittleProximal", riggedRightHand.RightLittleProximal);
        rigRotation("RightLittleIntermediate", riggedRightHand.RightLittleIntermediate);
        rigRotation("RightLittleDistal", riggedRightHand.RightLittleDistal);
    }
};

/* SETUP MEDIAPIPE HOLISTIC INSTANCE */
let videoElement = document.querySelector(".input_video"),
    guideCanvas = document.querySelector("canvas.guides");

const onResults = (results) => {
    // Snapshot raw face landmarks before they are mutated by Kalidokit
    const faceLandmarkSnapshot = results.faceLandmarks
        ? results.faceLandmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }))
        : null;

    // Draw landmark guides
    drawResults(results);
    // Animate model
    animateVRM(currentVrm, results, faceLandmarkSnapshot);
};

const holistic = new Holistic({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/${file}`;
    },
});

holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
    refineFaceLandmarks: true,
});
// Pass holistic a callback function
holistic.onResults(onResults);

const drawResults = (results) => {
    guideCanvas.width = videoElement.videoWidth;
    guideCanvas.height = videoElement.videoHeight;
    let canvasCtx = guideCanvas.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);
    // Use `Mediapipe` drawing functions
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "#00cff7",
        lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: "#ff0364",
        lineWidth: 2,
    });
    drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1,
    });
    if (results.faceLandmarks && results.faceLandmarks.length === 478) {
        //draw pupils
        drawLandmarks(canvasCtx, [results.faceLandmarks[468], results.faceLandmarks[468 + 5]], {
            color: "#ffe603",
            lineWidth: 2,
        });
    }
    drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {
        color: "#eb1064",
        lineWidth: 5,
    });
    drawLandmarks(canvasCtx, results.leftHandLandmarks, {
        color: "#00cff7",
        lineWidth: 2,
    });
    drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {
        color: "#22c3e3",
        lineWidth: 5,
    });
    drawLandmarks(canvasCtx, results.rightHandLandmarks, {
        color: "#ff0364",
        lineWidth: 2,
    });
};

// Use `Mediapipe` utils to get camera - lower resolution = higher fps
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await holistic.send({ image: videoElement });
    },
    width: 640,
    height: 480,
});
camera.start();

/* FEATURE 1 — BRUSH ERASER FOR EACH CUTOUT CANVAS */
const maskCanvases = { eyeL: null, eyeR: null, mouth: null };
const brushSettings = { size: 10, hardness: 80 };

function paintMask(maskCtx, x, y, radius, hardness, mode) {
    const gradient = maskCtx.createRadialGradient(x, y, 0, x, y, radius);
    const innerStop = hardness / 100;
    if (mode === 'eraser') {
        gradient.addColorStop(0, `rgba(0,0,0,1)`);
        gradient.addColorStop(innerStop, `rgba(0,0,0,1)`);
        gradient.addColorStop(1, `rgba(0,0,0,0)`);
        maskCtx.globalCompositeOperation = 'destination-out';
    } else {
        gradient.addColorStop(0, `rgba(255,255,255,1)`);
        gradient.addColorStop(innerStop, `rgba(255,255,255,1)`);
        gradient.addColorStop(1, `rgba(255,255,255,0)`);
        maskCtx.globalCompositeOperation = 'source-over';
    }
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.globalCompositeOperation = 'source-over';
}

const initMasks = () => {
    const configs = {
        eyeL: { w: 100, h: 100 },
        eyeR: { w: 100, h: 100 },
        mouth: { w: 150, h: 100 }
    };

    Object.keys(configs).forEach(key => {
        const { w, h } = configs[key];
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, w, h);
        maskCanvases[key] = canvas;

        const previewCanvas = document.getElementById(key === "eyeL" ? "eye-l-canvas" : key === "eyeR" ? "eye-r-canvas" : "mouth-canvas");
        setupMaskPainting(previewCanvas, key);
    });
};

const setupMaskPainting = (canvas, key) => {
    let isPainting = false;
    const wrapper = canvas.parentElement;
    
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const paint = (e) => {
           if (!isPainting) return;
           const pos = getPos(e);
           const ctx = maskCanvases[key].getContext("2d");
           const activeToolBtn = wrapper.querySelector(".tool-btn.active");
           if (!activeToolBtn) return;
           const activeTool = activeToolBtn.dataset.tool;
           
           paintMask(ctx, pos.x, pos.y, brushSettings.size / 2, brushSettings.hardness, activeTool);
           
           if (cutoutTextures[key]) cutoutTextures[key].needsUpdate = true;
       };

     canvas.addEventListener("mousedown", (e) => { isPainting = true; paint(e); });
     canvas.addEventListener("mousemove", paint);
     window.addEventListener("mouseup", () => isPainting = false);
     
     // Touch support
     canvas.addEventListener("touchstart", (e) => { e.preventDefault(); isPainting = true; paint(e); });
     canvas.addEventListener("touchmove", (e) => { e.preventDefault(); paint(e); });
     canvas.addEventListener("touchend", () => isPainting = false);
 
     // Toolbar logic
     wrapper.querySelectorAll(".tool-btn").forEach(btn => {
         btn.addEventListener("click", () => {
             wrapper.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
             btn.classList.add("active");
         });
     });
 
     wrapper.querySelector(".reset-mask").addEventListener("click", () => {
         const ctx = maskCanvases[key].getContext("2d");
         ctx.globalCompositeOperation = "source-over";
         ctx.fillStyle = "white";
         ctx.fillRect(0, 0, maskCanvases[key].width, maskCanvases[key].height);
         if (cutoutTextures[key]) cutoutTextures[key].needsUpdate = true;
     });
 };

document.getElementById("brush-size").addEventListener("input", (e) => {
    brushSettings.size = parseInt(e.target.value);
});
document.getElementById("brush-hardness").addEventListener("input", (e) => {
    brushSettings.hardness = parseInt(e.target.value);
});

/* FEATURE 2 — TRANSFORM GIZMO */
const gizmoCanvas = document.getElementById("gizmo-canvas");
const gizmoCtx = gizmoCanvas ? gizmoCanvas.getContext("2d") : null;
let activeDot = null;

function drawGizmo() {
    if (!gizmoCanvas || !gizmoCtx) return;
    const w = gizmoCanvas.width;
    const h = gizmoCanvas.height;
    gizmoCtx.clearRect(0, 0, w, h);

    // Background & Grid
    gizmoCtx.fillStyle = "#1a1a1a";
    gizmoCtx.beginPath();
    gizmoCtx.roundRect(0, 0, w, h, 8);
    gizmoCtx.fill();

    gizmoCtx.strokeStyle = "#333";
    gizmoCtx.lineWidth = 1;
    for(let i=0; i<=10; i++) {
        const x = (i/10) * w;
        const y = (i/10) * h;
        gizmoCtx.beginPath(); gizmoCtx.moveTo(x, 0); gizmoCtx.lineTo(x, h); gizmoCtx.stroke();
        gizmoCtx.beginPath(); gizmoCtx.moveTo(0, y); gizmoCtx.lineTo(w, y); gizmoCtx.stroke();
    }

    // Dots
    const dots = [
        { label: "L", x: cutoutSettings.leX, y: cutoutSettings.leY, color: "#13a3f3", key: "le" },
        { label: "R", x: cutoutSettings.reX, y: cutoutSettings.reY, color: "#13a3f3", key: "re" },
        { label: "M", x: cutoutSettings.mX, y: cutoutSettings.mY, color: "#ff9800", key: "m" }
    ];

    dots.forEach(dot => {
        const px = ((dot.x + 1) / 2) * w;
        const py = (1 - (dot.y + 1) / 2) * h;

        if (activeDot === dot.key) {
            gizmoCtx.strokeStyle = "white";
            gizmoCtx.lineWidth = 2;
            gizmoCtx.beginPath();
            gizmoCtx.arc(px, py, 12, 0, Math.PI * 2);
            gizmoCtx.stroke();
        }

        gizmoCtx.fillStyle = dot.color;
        gizmoCtx.beginPath();
        gizmoCtx.arc(px, py, 8, 0, Math.PI * 2);
        gizmoCtx.fill();

        gizmoCtx.fillStyle = "white";
        gizmoCtx.font = "bold 10px Arial";
        gizmoCtx.textAlign = "center";
        gizmoCtx.textBaseline = "middle";
        gizmoCtx.fillText(dot.label, px, py);
    });
}

const handleGizmoInteraction = () => {
    if (!gizmoCanvas) return;
    const getDotAt = (x, y) => {
        const w = gizmoCanvas.width;
        const h = gizmoCanvas.height;
        const dots = [
            { x: cutoutSettings.leX, y: cutoutSettings.leY, key: "le" },
            { x: cutoutSettings.reX, y: cutoutSettings.reY, key: "re" },
            { x: cutoutSettings.mX, y: cutoutSettings.mY, key: "m" }
        ];
        return dots.find(dot => {
            const px = ((dot.x + 1) / 2) * w;
            const py = (1 - (dot.y + 1) / 2) * h;
            const dist = Math.hypot(px - x, py - y);
            return dist < 16;
        });
    };

    gizmoCanvas.addEventListener("mousedown", (e) => {
        const rect = gizmoCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dot = getDotAt(x, y);
        activeDot = dot ? dot.key : null;
        drawGizmo();
    });
};

/* INITIALIZATION */
initMasks();
handleGizmoInteraction();
drawGizmo();

// Selection Raycasting
renderer.domElement.addEventListener("mousedown", (e) => {
    if (!cutoutSettings.enabled) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, orbitCamera);
    const intersects = raycaster.intersectObjects(Object.values(cutoutPlanes).filter(p => p));
    
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        selectedPlane = Object.keys(cutoutPlanes).find(key => cutoutPlanes[key] === hit);
        e.stopPropagation();
    } else {
        selectedPlane = null;
    }
});

// SINGLE unified window mousemove — replaces all three separate ones 
window.addEventListener("mousemove", (e) => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;

    // 2D panel gizmo drag 
    if (activeDot && gizmoCanvas) {
        const rect = gizmoCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const valX = (x / rect.width) * 2 - 1;
        const valY = (1 - y / rect.height) * 2 - 1;
        cutoutSettings[activeDot + "X"] = valX;
        cutoutSettings[activeDot + "Y"] = valY;
        updateSettings();
    }

    // 3D overlay gizmo drag 
    if (isDraggingGizmo && selectedPlane) {
        const plane = cutoutPlanes[selectedPlane];
        const sens = 0.002;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        
        if (dragAxis === 'x') {
            plane.position.x += dx * sens;
        } else if (dragAxis === 'y') {
            plane.position.y -= dy * sens;
        } else if (dragAxis === 'z') {
            plane.position.z += dx * sens;
        } else if (dragAxis === 'xy') {
            plane.position.x += dx * sens;
            plane.position.y -= dy * sens;
        } else if (dragAxis === 'rotate') {
            plane.getWorldPosition(tmpVec);
            tmpVec.project(orbitCamera);
            const cx = (tmpVec.x * 0.5 + 0.5) * window.innerWidth;
            const cy = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
            const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
            plane.rotation.z = initialPlaneRotation + (currentAngle - rotateStartAngle);
        }
        
        dragStart.set(e.clientX, e.clientY);
        
        // Sync to settings
        const key = selectedPlane;
        if (key === 'eyeL') {
            cutoutSettings.leX = plane.position.x;
            cutoutSettings.leY = plane.position.y;
        } else if (key === 'eyeR') {
            cutoutSettings.reX = plane.position.x;
            cutoutSettings.reY = plane.position.y;
        } else if (key === 'mouth') {
            cutoutSettings.mX = plane.position.x;
            cutoutSettings.mY = plane.position.y;
        }
        cutoutSettings.zOffset = plane.position.z;
        
        updateSettings();
    }
});

// SINGLE unified window mouseup 
window.addEventListener("mouseup", () => {
    activeDot = null;
    isDraggingGizmo = false;
    dragAxis = null;
    orbitControls.enabled = true;
    drawGizmo();
});

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        selectedPlane = null;
    } else if (e.key.toLowerCase() === "g" && selectedPlane) {
        isDraggingGizmo = true;
        dragAxis = 'xy';
        orbitControls.enabled = false;
        // Assume current mouse position as start
        dragStart.set(window.mouseX || 0, window.mouseY || 0); 
    }
});
