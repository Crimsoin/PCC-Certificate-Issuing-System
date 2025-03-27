document.addEventListener("DOMContentLoaded", async function () {
    // Clear session storage on page load
    sessionStorage.removeItem("uploadedSignature");

    console.log("Fetching student data...");

    const API_URL = "http://127.0.0.1:5000/get-certificate-data";
    const EMAIL_API_URL = "http://127.0.0.1:5000/send-certificate"; // Updated email API endpoint
    const CERTIFICATE_TYPES = {
        COMPLETION: "completion",
        PARTICIPATION: "participation"
    };

    const tableBody = document.getElementById("studentTableBody");
    const sendConfirmationModal = document.getElementById("sendConfirmationModal");
    const recipientEmailSpan = document.getElementById("recipientEmail");
    const proceedButton = document.getElementById("proceedButton");
    const cancelButton = document.getElementById("cancelButton");

    async function fetchStudentData() {
        try {
            let response = await fetch(API_URL);
            let data = await response.json();

            console.log("Fetched Data:", data);

            if (!data || data.length === 0) {
                console.error("No data received.");
                updateCertificateStats(0, 0, 0, 0, 0); // Reset counters if no data
                return;
            }

            populateStudentTable(data);
            countCertificateStatuses(data); // Call countCertificateStatuses to update the counts
            updateButtonStates(); // Ensure button states are updated after fetching data
        } catch (error) {
            console.error("Error fetching student data:", error);
        }
    }

    function populateStudentTable(data) {
        tableBody.innerHTML = ""; // Clear table before inserting new rows

        const instructorSignatureUploaded = !!sessionStorage.getItem("uploadedSignature");

        data.forEach((student, index) => {
            let row = document.createElement("tr");
            const certificateStatus = student["Certificate Status"] || "N/A";
            let isViewButtonEnabled = false;
            let isSendButtonEnabled = false;

            switch (certificateStatus.toLowerCase()) {
                case "approved":
                case "issued":
                    isViewButtonEnabled = instructorSignatureUploaded;
                    isSendButtonEnabled = instructorSignatureUploaded;
                    break;
                case "on hold":
                case "pending":
                default:
                    isViewButtonEnabled = false;
                    isSendButtonEnabled = false;
                    break;
            }

            row.innerHTML = `
                <td><input type="checkbox" class="student-checkbox"></td>
                <td>${student["Student Name"] || "N/A"}</td>
                <td>${student["Certificate Type"] || "N/A"}</td>
                <td>${student["Hours"] || "N/A"}</td>
                <td>${student["Name of BootCamp"] || "N/A"}</td>
                <td>${student["Course Started"] || "N/A"}</td>
                <td>${student["Course Ended"] || "N/A"}</td>
                <td>${student["Name of Instructor"] || "N/A"}</td>
                <td>${student["Date Issued"] || "N/A"}</td>
                <td>${student["Payment Status"] || "N/A"}</td>
                <td>${student["Certificate Status"] || "N/A"}</td>
                <td>${student["Student Email"] || "N/A"}</td>
                <td><button class="view-btn" data-index="${index}" ${isViewButtonEnabled ? "" : "disabled"}>View</button></td>
                <td><button class="send-btn" data-index="${index}" ${isSendButtonEnabled ? "" : "disabled"}>Send</button></td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners to send buttons
        document.querySelectorAll(".send-btn").forEach(button => {
            button.addEventListener("click", function () {
                const index = this.getAttribute("data-index");
                const student = data[index];
                const email = student["Student Email"] || "N/A";

                // Show the modal
                recipientEmailSpan.textContent = email;
                sendConfirmationModal.style.display = "flex";

                // Change the button to loader
                this.innerHTML = '<div class="loader"></div>';
                this.disabled = true;

                // Remove any existing event listeners on the proceed button
                proceedButton.replaceWith(proceedButton.cloneNode(true));
                const newProceedButton = document.getElementById("proceedButton");

                // Handle proceed button click
                newProceedButton.onclick = async function () {
                    const studentRow = document.querySelectorAll("#studentTableBody tr")[index];

                    const student = {
                        "Certificate Type": studentRow.cells[2].innerText || "N/A",
                        "Student Name": studentRow.cells[1].innerText || "N/A",
                        "Hours": studentRow.cells[3].innerText || "N/A",
                        "Name of BootCamp": studentRow.cells[4].innerText || "N/A",
                        "Course Started": studentRow.cells[5].innerText || "N/A",
                        "Course Ended": studentRow.cells[6].innerText || "N/A",
                        "Date Issued": studentRow.cells[8].innerText || "N/A",
                        "Name of Instructor": studentRow.cells[7].innerText || "N/A",
                        "Student Email": studentRow.cells[11].innerText || "N/A"
                    };

                    // Disable the proceed button to prevent double-clicking
                    newProceedButton.disabled = true;

                    const pdfData = await generateAndDownloadCertificate(student);
                    await sendEmailWithCertificate(student, pdfData);

                    // Reset button text and state after sending email
                    const sendButton = document.querySelector(`.send-btn[data-index="${index}"]`);
                    sendButton.innerHTML = 'Send';
                    sendButton.disabled = false;

                    sendConfirmationModal.style.display = "none";
                };

                // Handle cancel button click
                cancelButton.onclick = function () {
                    sendConfirmationModal.style.display = "none";

                    // Reset button text and state if cancelled
                    const sendButton = document.querySelector(`.send-btn[data-index="${index}"]`);
                    sendButton.innerHTML = 'Send';
                    sendButton.disabled = false;
                };
            });
        });
    }

    function sendCertificate(email) {
        // Implement the logic to send the certificate to the email
        console.log(`Sending certificate to ${email}`);
    }

    function countCertificateStatuses(data) {
        let pendingCount = 0;
        let issuedCount = 0;
        let approvedCount = 0;
        let onHoldCount = 0;

        data.forEach(student => {
            const certificateStatus = student["Certificate Status"] || "N/A";
            switch (certificateStatus.toLowerCase()) {
                case "pending":
                    pendingCount++;
                    break;
                case "issued":
                    issuedCount++;
                    break;
                case "approved":
                    approvedCount++;
                    break;
                case "on hold":
                    onHoldCount++;
                    break;
            }
        });

        document.getElementById("pendingCertificates").textContent = pendingCount;
        document.getElementById("issuedCertificates").textContent = issuedCount;
        document.getElementById("approvedCertificates").textContent = approvedCount;
        document.getElementById("onHoldCertificates").textContent = onHoldCount;
        document.getElementById("totalStudents").textContent = data.length; // Update total students count
    }

    function updateCertificateStats(total, pending, issued, approved, onHold) {
        document.getElementById("totalStudents").textContent = total;
        document.getElementById("pendingCertificates").textContent = pending;
        document.getElementById("issuedCertificates").textContent = issued;
        document.getElementById("approvedCertificates").textContent = approved;
        document.getElementById("onHoldCertificates").textContent = onHold;
    }

    function initializeSelectAllFunctionality() {
        const selectAllCheckbox = document.getElementById("selectAll");

        if (!selectAllCheckbox) {
            console.error("Select All checkbox not found!");
            return;
        }

        selectAllCheckbox.addEventListener("change", function () {
            const studentCheckboxes = document.querySelectorAll(".student-checkbox");
            studentCheckboxes.forEach(checkbox => {
                const row = checkbox.closest("tr");
                const certificateStatus = row.cells[10].innerText || "N/A";
                if (certificateStatus.toLowerCase() !== "pending" && certificateStatus.toLowerCase() !== "on hold") {
                    checkbox.checked = selectAllCheckbox.checked;
                }
            });
            updateButtonStates(); // Ensure button states are updated after changing the "Select All" checkbox
        });

        document.addEventListener("change", function (event) {
            if (event.target.classList.contains("student-checkbox")) {
                const studentCheckboxes = document.querySelectorAll(".student-checkbox");
                const allChecked = [...studentCheckboxes].every(checkbox => {
                    const row = checkbox.closest("tr");
                    const certificateStatus = row.cells[10].innerText || "N/A";
                    return checkbox.checked || (certificateStatus.toLowerCase() === "pending" || certificateStatus.toLowerCase() === "on hold");
                });
                selectAllCheckbox.checked = allChecked;
                updateButtonStates(); // Ensure button states are updated after changing individual checkboxes
            }
        });
    }

    function handleViewButtonClick(event) {
        if (event.target.classList.contains("view-btn")) {
            let studentIndex = event.target.getAttribute("data-index");
            let student = document.querySelectorAll("#studentTableBody tr")[studentIndex];

            if (!student) {
                console.error("Student data not found for index:", studentIndex);
                return;
            }

            let certificateType = student.cells[2].innerText || "N/A";
            let studentName = student.cells[1].innerText || "N/A";
            let hours = student.cells[3].innerText || "N/A";
            let bootcamp = student.cells[4].innerText || "N/A";
            let startDate = student.cells[5].innerText || "N/A";
            let endDate = student.cells[6].innerText || "N/A";
            let dateIssued = student.cells[8].innerText || "N/A";
            let instructor = student.cells[7].innerText || "N/A";

            let text1 = "has successfully attended";
            let text2 = "hours of training of";

            if (certificateType.toLowerCase() === CERTIFICATE_TYPES.COMPLETION) {
                text1 = "has successfully completed";
                text2 = "hours of training and course requirements of";
            }

            console.log("Opening modal for:", studentName);

            document.getElementById("certificateType").textContent = certificateType;
            document.getElementById("studentName").textContent = studentName;
            document.getElementById("hoursCompleted").textContent = hours;
            document.getElementById("bootcampName").textContent = bootcamp;
            document.getElementById("startDate").textContent = startDate;
            document.getElementById("endDate").textContent = endDate;
            document.getElementById("dateIssued").textContent = dateIssued;
            document.getElementById("instructorName").textContent = instructor;
            document.getElementById("text1").textContent = text1;
            document.getElementById("text2").textContent = text2;

            let modal = document.getElementById("certificateModal");
            modal.style.display = "flex";
        }
    }

    function handleModalClose(event) {
        if (event.target.classList.contains("close")) {
            document.getElementById("certificateModal").style.display = "none";
        }
    }

    function handleOutsideModalClick(event) {
        let modal = document.getElementById("certificateModal");
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }

    function handleDownloadButtonClick() {
        console.log("Download button clicked");
        const student = {
            "Certificate Type": document.getElementById("certificateType").textContent || "N/A",
            "Student Name": document.getElementById("studentName").textContent || "N/A",
            "Hours": document.getElementById("hoursCompleted").textContent || "N/A",
            "Name of BootCamp": document.getElementById("bootcampName").textContent || "N/A",
            "Course Started": document.getElementById("startDate").textContent || "N/A",
            "Course Ended": document.getElementById("endDate").textContent || "N/A",
            "Date Issued": document.getElementById("dateIssued").textContent || "N/A",
            "Name of Instructor": document.getElementById("instructorName").textContent || "N/A"
        };

        generateAndDownloadCertificate(student);
    }

    async function generateAndDownloadCertificate(student) {
        return new Promise((resolve) => {
            let certificateContainer = document.getElementById("certificateContainer");

            if (!certificateContainer) {
                certificateContainer = document.createElement("div");
                certificateContainer.id = "certificateContainer";
                certificateContainer.style.position = "absolute";
                certificateContainer.style.left = "-9999px"; // Hide off-screen
                document.body.appendChild(certificateContainer);
            }

            const backgroundImage = "/static/images/Background.jpg";

            certificateContainer.innerHTML = `
                <div class="certificate-content" style="width: 1123px; height: 794px; 
                    background: url('${backgroundImage}') no-repeat center center; 
                    background-size: cover; padding: 20px; position: relative;">
                    <p id="certificateTitle">CERTIFICATE</p>
                    <p class="certificate-subtitle">OF <span id="certificateType">${student["Certificate Type"] || "N/A"}</span></p>
                    <div class="details-details-acknowledge">This acknowledges that</div>
                    <p id="studentName">${student["Student Name"] || "N/A"}</p>
                    <div class="durationCompleted">
                        <span>${student["Certificate Type"].toLowerCase() === CERTIFICATE_TYPES.COMPLETION ? "has successfully completed" : "has successfully attended"} </span> 
                        <span>${student["Hours"] || "N/A"}</span>
                        <span>${student["Certificate Type"].toLowerCase() === CERTIFICATE_TYPES.COMPLETION ? "hours of training and course requirements of" : "hours of training of"} </span> 
                    </div>
                    <p id="bootcampName">${student["Name of BootCamp"] || "N/A"}</p>
                    <div class="details-period">
                        <span>Learning Period:</span>
                        <span>${student["Course Started"] || "N/A"}</span>
                        <span> to </span>
                        <span>${student["Course Ended"] || "N/A"}</span>
                    </div>
                    <div class="details-issued">
                        <span>Given this</span>
                        <span>${student["Date Issued"] || "N/A"}.</span>
                    </div>
                    <div class="signature-container">
                        <div class="signature">
                            <img src="${uploadedSignatureURL || "/static/images/signature-instructor.png"}" alt="Instructor Signature" class="signature-image">
                            <span class="signature-name">${student["Name of Instructor"] || "N/A"}</span>
                            <div class="signature-title">INSTRUCTOR</div>
                        </div>
                        <div class="signature">
                            <img src="/static/images/signature-ceo.png" alt="CEO Signature" class="signature-image">
                            <span class="signature-name">Dr. Gabriel Avelino Sampedro</span>
                            <div class="signature-title">FOUNDER/CEO</div>
                        </div>
                    </div>
                </div>
            `;

            const images = certificateContainer.querySelectorAll("img");
            const imagePromises = Array.from(images).map((img) => {
                return new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            });

            Promise.all(imagePromises).then(() => {
                setTimeout(() => {
                    html2canvas(certificateContainer, { 
                        scale: 2, // Reduce the scale to lower the resolution
                        useCORS: true, 
                        backgroundColor: null 
                    }).then((canvas) => {
                        const imgData = canvas.toDataURL("image/jpeg", 0.7); // Use JPEG format with lower quality
                        const pdf = new window.jspdf.jsPDF("landscape", "mm", "a4");

                        pdf.addImage(imgData, "JPEG", 10, 10, 277, 190); 
                        const pdfData = pdf.output('datauristring').split(',')[1]; // Get base64 part
                        resolve(pdfData);
                    });
                }, 500); 
            });
        });
    }

    async function sendEmailWithCertificate(student, pdfData) {
        try {
            const response = await fetch(EMAIL_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: student["Student Email"],
                    name: student["Student Name"],
                    certificate: pdfData
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send email');
            }

            alert(`Certificate sent to ${student["Student Email"]}`);
        } catch (error) {
            console.error("Error sending email:", error);
            alert(`Failed to send certificate to ${student["Student Email"]}`);
        }
    }

    document.getElementById("downloadSelected").addEventListener("click", async function () {
        console.log("Download Selected button clicked");
        let selectedStudents = [];

        document.querySelectorAll(".student-checkbox:checked").forEach((checkbox) => {
            let row = checkbox.closest("tr");
            let certificateStatus = row.cells[10].innerText || "N/A";
            if (certificateStatus.toLowerCase() === "approved" || certificateStatus.toLowerCase() === "issued") {
                let student = {
                    "Certificate Type": row.cells[2].innerText || "N/A",
                    "Student Name": row.cells[1].innerText || "N/A",
                    "Hours": row.cells[3].innerText || "N/A",
                    "Name of BootCamp": row.cells[4].innerText || "N/A",
                    "Course Started": row.cells[5].innerText || "N/A",
                    "Course Ended": row.cells[6].innerText || "N/A",
                    "Date Issued": row.cells[8].innerText || "N/A",
                    "Name of Instructor": row.cells[7].innerText || "N/A"
                };
                selectedStudents.push(student);
            }
        });

        if (selectedStudents.length === 0) {
            alert("No eligible students selected! Please select at least one student with an approved or issued certificate.");
            return;
        }

        for (const student of selectedStudents) {
            const pdfData = await generateAndDownloadCertificate(student);
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${pdfData}`;
            link.download = `${student["Student Name"]}_certificate.pdf`;
            link.click();
        }

        alert("Selected certificates have been downloaded.");
    });

    document.getElementById("sendSelected").addEventListener("click", async function () {
        console.log("Send Selected button clicked");
        let selectedStudents = [];

        const instructorSignatureUploaded = !!sessionStorage.getItem("uploadedSignature");

        if (!instructorSignatureUploaded) {
            alert("Instructor signature is not uploaded. Please upload the signature first.");
            return;
        }

        document.querySelectorAll(".student-checkbox:checked").forEach((checkbox) => {
            let row = checkbox.closest("tr");
            let certificateStatus = row.cells[10].innerText || "N/A";
            if (certificateStatus.toLowerCase() === "approved" || certificateStatus.toLowerCase() === "issued") {
                let student = {
                    "Certificate Type": row.cells[2].innerText || "N/A",
                    "Student Name": row.cells[1].innerText || "N/A",
                    "Hours": row.cells[3].innerText || "N/A",
                    "Name of BootCamp": row.cells[4].innerText || "N/A",
                    "Course Started": row.cells[5].innerText || "N/A",
                    "Course Ended": row.cells[6].innerText || "N/A",
                    "Date Issued": row.cells[8].innerText || "N/A",
                    "Name of Instructor": row.cells[7].innerText || "N/A",
                    "Student Email": row.cells[11].innerText || "N/A"
                };
                selectedStudents.push(student);
            }
        });

        if (selectedStudents.length === 0) {
            alert("No eligible students selected! Please select at least one student with an approved or issued certificate.");
            return;
        }

        for (const student of selectedStudents) {
            const pdfData = await generateAndDownloadCertificate(student);
            await sendEmailWithCertificate(student, pdfData);
        }

        alert("Selected certificates have been sent.");
    });

    function handleSignatureUpload() {
        const fileInput = document.getElementById("signatureUpload");
        const uploadButton = document.getElementById("uploadSignature");
        const removeButton = document.getElementById("removeSignature");
        const instructorSignatureImg = document.querySelector(".signature img");

        uploadButton.addEventListener("click", function () {
            const file = fileInput.files[0];

            if (!file) {
                alert("Please select a PNG file to upload.");
                return;
            }

            if (file.type !== "image/png") {
                alert("Only PNG files are allowed.");
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                uploadedSignatureURL = e.target.result;
                instructorSignatureImg.src = uploadedSignatureURL;
                sessionStorage.setItem("uploadedSignature", uploadedSignatureURL);

                // Enable "View" and "Send" buttons if conditions are met
                document.querySelectorAll(".view-btn, .send-btn").forEach(button => {
                    const row = button.closest("tr");
                    const certificateStatus = row.cells[10].innerText || "N/A";
                    if (certificateStatus.toLowerCase() === "approved" || certificateStatus.toLowerCase() === "issued") {
                        button.disabled = false;
                    }
                });

                alert("Instructor signature uploaded successfully!");
                updateButtonStates(); // Ensure button states are updated after uploading signature

                // Change the upload button to remove button
                uploadButton.style.display = "none";
                removeButton.style.display = "inline-block";
            };

            reader.readAsDataURL(file);
        });

        removeButton.addEventListener("click", function () {
            sessionStorage.removeItem("uploadedSignature");
            instructorSignatureImg.src = "";
            uploadedSignatureURL = "";

            // Disable "View" and "Send" buttons
            document.querySelectorAll(".view-btn, .send-btn").forEach(button => {
                button.disabled = true;
            });

            uploadButton.style.display = "inline-block";
            removeButton.style.display = "none";

            alert("Instructor signature removed successfully!");
            updateButtonStates(); // Ensure button states are updated after removing signature
        });

        const savedSignature = sessionStorage.getItem("uploadedSignature");
        if (savedSignature) {
            instructorSignatureImg.src = savedSignature;
            uploadedSignatureURL = savedSignature;

            // Enable "View" and "Send" buttons if conditions are met
            document.querySelectorAll(".view-btn, .send-btn").forEach(button => {
                const row = button.closest("tr");
                const certificateStatus = row.cells[10].innerText || "N/A";
                if (certificateStatus.toLowerCase() === "approved" || certificateStatus.toLowerCase() === "issued") {
                    button.disabled = false;
                }
            });

            uploadButton.style.display = "none";
            removeButton.style.display = "inline-block";
        }
    }

    // Debug Modal Logic
    document.getElementById("Debug").addEventListener("click", function () {
        const modal = document.getElementById("debugModal");
        modal.style.display = "block";
    });

    document.querySelector(".modal .close").addEventListener("click", function () {
        const modal = document.getElementById("debugModal");
        modal.style.display = "none";
    });

    window.addEventListener("click", function (event) {
        const modal = document.getElementById("debugModal");
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });

    function updateButtonStates() {
        const instructorSignatureUploaded = !!sessionStorage.getItem("uploadedSignature");
        const studentCheckboxes = document.querySelectorAll(".student-checkbox");
        const anyCheckboxChecked = Array.from(studentCheckboxes).some(checkbox => checkbox.checked);

        document.querySelectorAll(".view-btn, .send-btn").forEach(button => {
            const row = button.closest("tr");
            const certificateStatus = row.cells[10].innerText || "N/A";
            let isViewButtonEnabled = false;
            let isSendButtonEnabled = false;

            switch (certificateStatus.toLowerCase()) {
                case "approved":
                case "issued":
                    isViewButtonEnabled = instructorSignatureUploaded;
                    isSendButtonEnabled = instructorSignatureUploaded;
                    break;
                case "on hold":
                case "pending":
                default:
                    isViewButtonEnabled = false;
                    isSendButtonEnabled = false;
                    break;
            }

            button.disabled = button.classList.contains("send-btn") ? !isSendButtonEnabled : !isViewButtonEnabled;
        });

        document.getElementById("downloadSelected").disabled = !anyCheckboxChecked || !instructorSignatureUploaded;
        document.getElementById("sendSelected").disabled = !anyCheckboxChecked || !instructorSignatureUploaded;

        document.querySelectorAll(".student-checkbox").forEach(checkbox => {
            const row = checkbox.closest("tr");
            const certificateStatus = row.cells[10].innerText || "N/A";
            if (certificateStatus.toLowerCase() === "pending" || certificateStatus.toLowerCase() === "on hold") {
                checkbox.disabled = true;
            }
        });
    }

    // Call updateButtonStates after fetching student data
    fetchStudentData().then(() => {
        updateButtonStates();
    });

    // Update button states when a checkbox is changed
    document.addEventListener("change", function (event) {
        if (event.target.classList.contains("student-checkbox")) {
            updateButtonStates();
        }
    });

    // Update button states when the instructor signature is uploaded or removed
    document.getElementById("uploadSignature").addEventListener("click", function () {
        updateButtonStates();
    });

    document.getElementById("removeSignature").addEventListener("click", function () {
        updateButtonStates();
    });

    document.addEventListener("click", handleViewButtonClick);
    document.addEventListener("click", handleModalClose);
    window.addEventListener("click", handleOutsideModalClick);
    document.getElementById("downloadButton").addEventListener("click", handleDownloadButtonClick);

    fetchStudentData();
    initializeSelectAllFunctionality();
    handleSignatureUpload();
});

