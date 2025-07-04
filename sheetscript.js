// In your Apps Script project
function doGet(e) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(5000); // 5 second timeout

        const ss = SpreadsheetApp.openById('1XUTEiA_THpx_guKbfcNL38NT4JIaV0XgLshqtz9-CWk');
        const sheet = ss.getSheetByName('sheet1');
        const data = sheet.getDataRange().getValues();

        // Process data from URL parameters
        const params = e.parameter;
        const idNumber = params.idNumber.toLowerCase().trim();
        const email = params.email.toLowerCase().trim();
        const phone = params.phone.toLowerCase().trim();

        // Check for duplicates
        const isDuplicate = data.some(row => {
            const rowIdNumber = row[1]?.toString().toLowerCase().trim();
            const rowEmail = row[6]?.toString().toLowerCase().trim();
            const rowPhone = row[7]?.toString().toLowerCase().trim();
            return rowIdNumber === idNumber || rowEmail === email || rowPhone === phone;
        });

        if (isDuplicate) {
            return wrapResponse(e.parameter.callback, {
                success: false,
                error: "This email/Phone,cor ID number is already registered"
            });
        }

        // Add new entry
        sheet.appendRow([
            idNumber, // ID Number
            params.fullName.trim(),
            params.dob.trim(),
            params.gender.trim(),
            params.address.trim(),
            email,
            phone,
            params.photo.trim(),
            params.descriptor ? params.descriptor.split(',').map(d => d.trim()) : [],
            hasVoted, // hasVoted
            new Date().toISOString() // enrolledAt
        ]);

        return wrapResponse(e.parameter.callback, { success: true });

    } catch (error) {
        return wrapResponse(e.parameter.callback, {
            success: false,
            error: error.message
        });
    } finally {
        lock.releaseLock();
    }
}

function wrapResponse(callback, data) {
    const response = ContentService.createTextOutput(
        callback + '(' + JSON.stringify(data) + ')'
    );
    response.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return response;
}