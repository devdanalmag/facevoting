// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const verificationVideo = document.getElementById('verification-video');
const verificationCanvas = document.getElementById('verification-canvas');
const captureBtn = document.getElementById('capture-btn');
const enrollBtn = document.getElementById('enroll-btn');
const verifyBtn = document.getElementById('verify-btn');
const castVoteBtn = document.getElementById('cast-vote-btn');
const refreshListBtn = document.getElementById('refresh-list-btn');
const resetCameraBtn = document.getElementById('reset-camera-btn');
const previewPhoto = document.getElementById('preview-photo');
const voterInfo = document.getElementById('voter-info');
const verificationResult = document.getElementById('verification-result');
const votersList = document.getElementById('voters-list');
const voterCount = document.getElementById('voter-count');
const votedCount = document.getElementById('voted-count');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');

// Form fields
const fullName = document.getElementById('fullName');
const idNumber = document.getElementById('idNumber');
const dob = document.getElementById('dob');
const gender = document.getElementById('gender');
const address = document.getElementById('address');
const phone = document.getElementById('phone');
const email = document.getElementById('email');

// Info display fields
const infoName = document.getElementById('info-name');
const infoId = document.getElementById('info-id');
const infoDob = document.getElementById('info-dob');
const infoGender = document.getElementById('info-gender');
const infoAddress = document.getElementById('info-address');
const infoPhone = document.getElementById('info-phone');
const infoEmail = document.getElementById('info-email');
const infoStatus = document.getElementById('info-status');

// Variables
let enrollmentStream = null;
let verificationStream = null;
let capturedPhoto = null;
let voters = [];
let currentVoter = null;

// Page navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.getAttribute('data-page');

        // Update active nav link
        navLinks.forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');

        // Show selected page
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');

        // Handle page-specific initializations
        if (pageId === 'enroll-page') {
            startEnrollmentCamera();
            stopVerificationCamera();
        } else if (pageId === 'verify-page') {
            stopEnrollmentCamera();
            startVerificationCamera();
        } else if (pageId === 'admin-page') {
            stopEnrollmentCamera();
            stopVerificationCamera();
            displayVotersList();
        }
    });
});

// Initialize face-api.js models
async function loadModels() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        console.log('Face detection models loaded');
    } catch (error) {
        console.error('Error loading models:', error);
        showAlert('Error loading face detection models. Please try again.', false);
    }
}

// Start enrollment camera
async function startEnrollmentCamera() {
    try {
        stopEnrollmentCamera();
        enrollmentStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false
        });
        video.srcObject = enrollmentStream;
        captureBtn.disabled = false;
    } catch (err) {
        console.error("Error accessing camera: ", err);
        showAlert("Could not access the camera. Please ensure you've granted camera permissions.", false);
    }
}

// Start verification camera
async function startVerificationCamera() {
    try {
        stopVerificationCamera();
        verificationStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false
        });
        verificationVideo.srcObject = verificationStream;
        verifyBtn.disabled = false;
    } catch (err) {
        console.error("Error accessing camera: ", err);
        showAlert("Could not access the camera. Please ensure you've granted camera permissions.", false);
    }
}

// Stop enrollment camera
function stopEnrollmentCamera() {
    if (enrollmentStream) {
        enrollmentStream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        captureBtn.disabled = true;
    }
}

// Stop verification camera
function stopVerificationCamera() {
    if (verificationStream) {
        verificationStream.getTracks().forEach(track => track.stop());
        verificationVideo.srcObject = null;
        verifyBtn.disabled = true;
    }
}

// Capture photo for enrollment
async function capturePhoto() {
    if (!enrollmentStream) return;

    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the image data
    capturedPhoto = canvas.toDataURL('image/png');

    try {
        // Detect faces in the captured image
        const detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length === 0) {
            showAlert("No face detected. Please try again.", false);
            return;
        }

        if (detections.length > 1) {
            showAlert("Multiple faces detected. Only one person is allowed in the photo.", false);
            return;
        }

        // Show preview
        previewPhoto.src = capturedPhoto;
        previewPhoto.style.display = 'block';

        // Enable enroll button
        enrollBtn.disabled = false;

        showAlert("Photo captured successfully! Please complete the form and click 'Enroll Voter'.", true);
    } catch (error) {
        console.error("Face detection error:", error);
        showAlert("Error processing face detection. Please try again.", false);
    }
}

// Enroll new voter
async function enrollVoter() {
    if (!capturedPhoto) {
        showAlert("Please capture a photo first.", false);
        return;
    }

    // Validate form
    if (!fullName.value || !idNumber.value || !dob.value || !gender.value || !address.value || !phone.value) {
        showAlert("Please fill all required fields.", false);
        return;
    }

    // Check if ID already exists
    if (voters.some(voter => voter.idNumber === idNumber.value)) {
        showAlert("A voter with this ID number is already registered.", false);
        return;
    }

    try {
        // Get face descriptor
        const detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length === 0) {
            showAlert("No face detected in the captured photo. Please try again.", false);
            return;
        }

        const descriptor = detections[0].descriptor;

        const newDescriptor = detections[0].descriptor;

        // Duplicate face check
        let duplicateFound = voters.some(voter => {
            const storedDescriptor = new Float32Array(voter.descriptor);
            const distance = faceapi.euclideanDistance(newDescriptor, storedDescriptor);
            return distance < 0.5;
        });

        if (duplicateFound) {
            showAlert("This face is already registered with another ID. Duplicate registrations are not allowed.", false);
            return;
        }

        // Create voter object
        const voter = {
            id: Date.now().toString(),
            fullName: fullName.value,
            idNumber: idNumber.value,
            dob: dob.value,
            gender: gender.value,
            address: address.value,
            phone: phone.value,
            email: email.value,
            photo: capturedPhoto,
            descriptor: Array.from(descriptor), // Convert Float32Array to regular array
            hasVoted: false,
            enrolledAt: new Date().toISOString()
        };

        // Add to voters array
        voters.push(voter);

        // Save to localStorage
        localStorage.setItem('voters', JSON.stringify(voters));

        // Reset form
        document.getElementById('enroll-form').reset();
        previewPhoto.style.display = 'none';
        capturedPhoto = null;
        enrollBtn.disabled = true;

        showAlert(`Voter ${voter.fullName} enrolled successfully!`, true);

        // Update counts
        updateVoterCounts();
    } catch (error) {
        console.error("Enrollment error:", error);
        showAlert("Error enrolling voter. Please try again.", false);
    }
}

// Verify voter
async function verifyVoter() {
    if (!verificationStream) return;

    // Draw video frame to canvas
    const context = verificationCanvas.getContext('2d');
    context.drawImage(verificationVideo, 0, 0, verificationCanvas.width, verificationCanvas.height);

    try {
        // Detect faces in the captured image
        const detections = await faceapi.detectAllFaces(verificationCanvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length === 0) {
            showVerificationResult("No face detected. Please try again.", false);
            return;
        }

        if (detections.length > 1) {
            showVerificationResult("Multiple faces detected. Only one person can verify at a time.", false);
            return;
        }

        const currentDescriptor = detections[0].descriptor;

        // Find the best match among registered voters
        let bestMatch = null;
        let minDistance = Infinity;

        for (const voter of voters) {
            // Convert stored descriptor back to Float32Array
            const storedDescriptor = new Float32Array(voter.descriptor);
            const distance = faceapi.euclideanDistance(currentDescriptor, storedDescriptor);

            if (distance < minDistance && distance < 0.5) { // Threshold for matching
                minDistance = distance;
                bestMatch = voter;
            }
        }

        if (bestMatch) {
            currentVoter = bestMatch;
            displayVoterInfo(bestMatch);
            showVerificationResult(`Verification successful! Welcome ${bestMatch.fullName}.`, true);
        } else {
            showVerificationResult("No matching voter found. Please enroll first.", false);
            voterInfo.style.display = 'none';
        }
    } catch (error) {
        console.error("Verification error:", error);
        showVerificationResult("Error during verification. Please try again.", false);
    }
}

// Display voter information
function displayVoterInfo(voter) {
    infoName.textContent = voter.fullName;
    infoId.textContent = voter.idNumber;
    infoDob.textContent = new Date(voter.dob).toLocaleDateString();
    infoGender.textContent = voter.gender;
    infoAddress.textContent = voter.address;
    infoPhone.textContent = voter.phone;
    infoEmail.textContent = voter.email || 'N/A';

    if (voter.hasVoted) {
        infoStatus.textContent = `Already voted on ${new Date(voter.votedAt).toLocaleString()}`;
        infoStatus.style.color = '#dc3545';
        castVoteBtn.disabled = true;
    } else {
        infoStatus.textContent = 'Eligible to vote';
        infoStatus.style.color = '#28a745';
        castVoteBtn.disabled = false;
    }

    voterInfo.style.display = 'block';
}

// Show verification result
function showVerificationResult(message, isSuccess) {
    verificationResult.textContent = message;
    verificationResult.className = isSuccess ? 'alert alert-success' : 'alert alert-danger';
    verificationResult.style.display = 'block';
}

// Show general alert
// Show alert popup
function showAlert(title, message, isSuccess) {
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertPopup.className = isSuccess ? 'alert-popup success' : 'alert-popup error';
    alertPopup.style.display = 'block';
    overlay.style.display = 'block';
}

// Close alert popup
function closeAlert() {
    alertPopup.style.display = 'none';
    overlay.style.display = 'none';
}

// Toggle mobile menu
menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('active');
});

// Close alert when clicking OK or overlay
alertClose.addEventListener('click', closeAlert);
overlay.addEventListener('click', closeAlert);

// Cast vote
function castVote() {
    if (!currentVoter) return;

    if (currentVoter.hasVoted) {
        showAlert("This voter has already cast their vote.", false);
        return;
    }

    // Update voter status
    currentVoter.hasVoted = true;
    currentVoter.votedAt = new Date().toISOString();

    // Update in voters array
    const index = voters.findIndex(v => v.id === currentVoter.id);
    if (index !== -1) {
        voters[index] = currentVoter;
    }

    // Save to localStorage
    localStorage.setItem('voters', JSON.stringify(voters));

    // Update UI
    infoStatus.textContent = `Voted on ${new Date(currentVoter.votedAt).toLocaleString()}`;
    infoStatus.style.color = '#dc3545';
    castVoteBtn.disabled = true;

    // Update counts
    updateVoterCounts();

    showAlert(`Vote recorded for ${currentVoter.fullName}. Thank you!`, true);
}

// Display list of voters
function displayVotersList() {
    votersList.innerHTML = '';

    if (voters.length === 0) {
        votersList.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No voters enrolled yet.</p>';
        return;
    }

    voters.forEach(voter => {
        const card = document.createElement('div');
        card.className = 'voter-card';

        card.innerHTML = `
                    <img src="${voter.photo}" alt="${voter.fullName}" class="voter-photo">
                    <div class="voter-details">
                        <div class="voter-name">${voter.fullName}</div>
                        <div class="voter-id">ID: ${voter.idNumber}</div>
                        <div>Enrolled: ${new Date(voter.enrolledAt).toLocaleDateString()}</div>
                        <div class="voter-status ${voter.hasVoted ? 'status-voted' : 'status-not-voted'}">
                            ${voter.hasVoted ?
                `Voted on ${new Date(voter.votedAt).toLocaleDateString()}` :
                'Not voted yet'}
                        </div>
                    </div>
                `;

        votersList.appendChild(card);
    });
}

// Update voter and voted counts
function updateVoterCounts() {
    voterCount.textContent = `${voters.length} voters`;
    const voted = voters.filter(v => v.hasVoted).length;
    votedCount.textContent = `${voted} voted`;
}

// Load voters from localStorage
function loadVoters() {
    const storedVoters = localStorage.getItem('voters');
    if (storedVoters) {
        voters = JSON.parse(storedVoters);
        updateVoterCounts();
    }
}

// Initialize the app
async function init() {
    await loadModels();
    loadVoters();
    startEnrollmentCamera();

    // Set today's date as max for date of birth
    dob.max = new Date().toISOString().split('T')[0];
}

// Event listeners
captureBtn.addEventListener('click', capturePhoto);
enrollBtn.addEventListener('click', enrollVoter);
verifyBtn.addEventListener('click', verifyVoter);
castVoteBtn.addEventListener('click', castVote);
refreshListBtn.addEventListener('click', () => {
    displayVotersList();
    showAlert("Voter list refreshed.", true);
});
resetCameraBtn.addEventListener('click', startEnrollmentCamera);

// Start the app
init();
