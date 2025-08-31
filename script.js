// Attendance data storage
let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];

// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const tableBody = document.getElementById('tableBody');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');

// Video stream and scanning variables
let stream = null;
let scanning = false;
let animationFrame = null;

// Initialize the table with existing data
updateTable();

// Event listeners
startButton.addEventListener('click', startScanner);
stopButton.addEventListener('click', stopScanner);
downloadBtn.addEventListener('click', downloadExcel);
clearBtn.addEventListener('click', clearRecords);

// Start the QR scanner
async function startScanner() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        video.srcObject = stream;
        video.play();
        
        startButton.disabled = true;
        stopButton.disabled = false;
        scanning = true;
        
        statusDiv.textContent = "Scanner started. Point camera at QR code.";
        statusDiv.className = "success";
        
        scanQRCode();
    } catch (err) {
        console.error("Error accessing camera:", err);
        statusDiv.textContent = "Error accessing camera: " + err.message;
        statusDiv.className = "error";
    }
}

// Stop the QR scanner
function stopScanner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    
    scanning = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    
    statusDiv.textContent = "Scanner stopped.";
    statusDiv.className = "";
}

// Scan for QR codes
function scanQRCode() {
    if (!scanning) return;
    
    const canvasElement = document.getElementById('canvas');
    const canvasContext = canvasElement.getContext('2d');
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.height = video.videoHeight;
        canvasElement.width = video.videoWidth;
        
        // Draw video frame to canvas
        canvasContext.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        // Get image data from canvas
        const imageData = canvasContext.getImageData(0, 0, canvasElement.width, canvasElement.height);
        
        // Decode QR code
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        
        if (code) {
            // QR code found
            processQRCode(code.data);
        }
    }
    
    animationFrame = requestAnimationFrame(scanQRCode);
}

// Process the scanned QR code
function processQRCode(qrData) {
    try {
        // Parse QR data (assuming format: "studentId:studentName")
        const [studentId, studentName] = qrData.split(':');
        
        // Check if student is already marked present today
        const today = new Date().toDateString();
        const alreadyMarked = attendanceData.some(record => 
            record.studentId === studentId && 
            new Date(record.timestamp).toDateString() === today
        );
        
        if (alreadyMarked) {
            statusDiv.textContent = `${studentName} (${studentId}) already marked present today.`;
            statusDiv.className = "error";
            return;
        }
        
        // Add new attendance record
        const timestamp = new Date().toISOString();
        const record = {
            studentId,
            studentName,
            timestamp
        };
        
        attendanceData.push(record);
        saveData();
        updateTable();
        
        statusDiv.textContent = `Attendance marked for ${studentName} (${studentId})`;
        statusDiv.className = "success";
        
        // Temporarily stop scanning to prevent duplicate scans
        scanning = false;
        setTimeout(() => {
            scanning = true;
            scanQRCode();
        }, 2000);
        
    } catch (err) {
        console.error("Error processing QR code:", err);
        statusDiv.textContent = "Invalid QR code format. Expected 'studentId:studentName'";
        statusDiv.className = "error";
    }
}

// Update the attendance table
function updateTable() {
    tableBody.innerHTML = '';
    
    attendanceData.forEach(record => {
        const row = document.createElement('tr');
        
        const idCell = document.createElement('td');
        idCell.textContent = record.studentId;
        
        const nameCell = document.createElement('td');
        nameCell.textContent = record.studentName;
        
        const timeCell = document.createElement('td');
        const date = new Date(record.timestamp);
        timeCell.textContent = date.toLocaleString();
        
        row.appendChild(idCell);
        row.appendChild(nameCell);
        row.appendChild(timeCell);
        
        tableBody.appendChild(row);
    });
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
}

// Download data as Excel file
function downloadExcel() {
    if (attendanceData.length === 0) {
        statusDiv.textContent = "No attendance records to download.";
        statusDiv.className = "error";
        return;
    }
    
    // Prepare worksheet
    const wsData = [
        ["Student ID", "Name", "Timestamp"],
        ...attendanceData.map(record => [
            record.studentId,
            record.studentName,
            new Date(record.timestamp).toLocaleString()
        ])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    
    // Generate file and download
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `attendance_${date}.xlsx`);
    
    statusDiv.textContent = "Excel file downloaded successfully.";
    statusDiv.className = "success";
}

// Clear all records
function clearRecords() {
    if (confirm("Are you sure you want to clear all attendance records?")) {
        attendanceData = [];
        saveData();
        updateTable();
        statusDiv.textContent = "All attendance records cleared.";
        statusDiv.className = "success";
    }
}

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    stopScanner();
});