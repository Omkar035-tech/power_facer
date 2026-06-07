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

function animate() {
    requestAnimationFrame(animate);

    if (currentVrm) {
        // Update model to render physics
        currentVrm.update(clock.getDelta());
    }
    renderer.render(scene, orbitCamera);
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
    cutoutSettings.leX = parseFloat(document.getElementById("le-x").value);
    cutoutSettings.leY = parseFloat(document.getElementById("le-y").value);
    cutoutSettings.reX = parseFloat(document.getElementById("re-x").value);
    cutoutSettings.reY = parseFloat(document.getElementById("re-y").value);
    cutoutSettings.mX = parseFloat(document.getElementById("m-x").value);
    cutoutSettings.mY = parseFloat(document.getElementById("m-y").value);
    cutoutSettings.zOffset = parseFloat(document.getElementById("z-offset").value);
    cutoutSettings.scale = parseFloat(document.getElementById("cutout-scale").value);

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
