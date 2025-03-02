import * as THREE from "three";
import * as LocAR from "locar";

// Setup scene, camera, and renderer
const camera = new THREE.PerspectiveCamera(
  80,
  window.innerWidth / window.innerHeight,
  0.001,
  1000,
);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const locar = new LocAR.LocationBased(scene, camera);

// Handle window resizing
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Setup webcam renderer
const cam = new LocAR.WebcamRenderer(renderer);

// Raycaster setup
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Center crosshair
const crosshairGeometry = new THREE.RingGeometry(0.02, 0.03, 32);
const crosshairMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide,
});
const crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
crosshair.position.z = -1;
camera.add(crosshair);
scene.add(camera);

// Store box data
const boxes = new Map();

// Constant for animation
const ANIMATION_SPEED = 0.1;

let firstLocation = true;

// Create boxes at initial GPS location
locar.on("gpsupdate", (pos) => {
  if (firstLocation) {
    const boxSize = 10;
    const geom = new THREE.BoxGeometry(boxSize, boxSize, boxSize);

    const boxProps = [
      { latDis: 0.001, lonDis: 0, color: 0xff0000 },
      { latDis: -0.001, lonDis: 0, color: 0xffff00 },
      { latDis: 0, lonDis: -0.001, color: 0x00ffff },
      { latDis: 0, lonDis: 0.001, color: 0x00ff00 },
    ];

    boxProps.forEach(({ latDis, lonDis, color }) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geom, material);

      locar.add(
        mesh,
        pos.coords.longitude + lonDis * 0.5,
        pos.coords.latitude + latDis * 0.5,
      );

      boxes.set(mesh, {
        originalPosition: mesh.position.clone(),
        originalScale: mesh.scale.clone(),
        originalColor: color,
        lastHoverTime: 0,
      });

      mesh.renderOrder = 1;
    });

    firstLocation = false;
  }
});

function updateBoxes() {
  // Update raycaster
  pointer.set(0, 0);
  raycaster.setFromCamera(pointer, camera);

  const boxArray = Array.from(boxes.keys());
  const intersects = raycaster.intersectObjects(boxArray);

  boxArray.forEach((box) => {
    const data = boxes.get(box);
    const isHovered = intersects.length > 0 && intersects[0].object === box;

    if (isHovered) {
      // Bring boxes forward for inspection
      const forwardVector = new THREE.Vector3();
      camera.getWorldDirection(forwardVector);

      forwardVector.multiplyScalar(20);

      const targetPosition = camera.position.clone().add(forwardVector);
      console.log(targetPosition);
      box.position.lerp(targetPosition, ANIMATION_SPEED);
    } else {
      // Return to original position
      box.position.lerp(data.originalPosition, ANIMATION_SPEED);
      box.scale.lerp(data.originalScale, ANIMATION_SPEED);
      box.material.color.setHex(data.originalColor);
    }
  });
}

// Setup device orientation controls
const deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

// Start GPS tracking
locar.startGps();

// Animation loop
renderer.setAnimationLoop(() => {
  cam.update();
  deviceOrientationControls.update();
  updateBoxes();
  renderer.render(scene, camera);
});

// Add debug info
const debugDiv = document.createElement("div");
debugDiv.style.position = "fixed";
debugDiv.style.top = "10px";
debugDiv.style.left = "10px";
debugDiv.style.color = "white";
debugDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
debugDiv.style.padding = "10px";
document.body.appendChild(debugDiv);

// Update debug info every frame
setInterval(() => {
  const boxArray = Array.from(boxes.keys());
  const intersects = raycaster.intersectObjects(boxArray);
  debugDiv.innerHTML = `
    Boxes in scene: ${boxArray.length}<br>
    Raycast hits: ${intersects.length}<br>
    ${intersects.length > 0 ? `Hit distance: ${intersects[0].distance.toFixed(2)}` : "No hits"}<br>
    Camera position: ${camera.position
      .toArray()
      .map((v) => v.toFixed(2))
      .join(", ")}
  `;
}, 100);
