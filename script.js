var header = document.querySelector("header");

var onMenu = false;
var onTop = true;

window.addEventListener("scroll", function () {
    var shouldToggle = window.scrollY > 20;
    onTop = !shouldToggle;

    if (!document.querySelector('#sub-page') && !onMenu) {
        header.classList.toggle("visible", shouldToggle); 
    }
});

document.getElementById('header-text').addEventListener('click', function () {
    if (document.querySelector('#sub-page')) {
        window.location.href = "/";
    } else {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
});

const menuToggle = document.getElementById("menu-toggle");
const menu = document.getElementById("menu");

//menuToggle.addEventListener("click", () => {
//    onMenu = !onMenu;

//    if (onTop && !document.querySelector('#sub-page')) {
//        header.classList.toggle("visible", onMenu);
//    }
//
//    menu.classList.toggle("active");
//});

let connectedDevice = null;
let characteristic = null;
let serialPort = null;

document.getElementById('usb').addEventListener('click', async () => {
    await handleConnection("USB");
});

document.getElementById('bluetooth').addEventListener('click', async () => {
    await handleConnection("Bluetooth");
});

async function handleConnection(type) {
    const usbButton = document.getElementById("usb");
    const bluetoothButton = document.getElementById("bluetooth");
    const statusText = document.getElementById("connection-status");
    const controlSection = document.querySelector(".control-section");

    usbButton.disabled = true;
    bluetoothButton.disabled = true;
    statusText.textContent = "Connecting...";
    statusText.className = "";

    try {
        if (type === "USB") {
            const filters = [{ usbVendorId: 0x2341, usbProductId: 0x0043 }];
            serialPort = await navigator.serial.requestPort({ filters });
            await serialPort.open({ baudRate: 9600 });
            readSerial(serialPort);
        } else {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb"]
            });

            console.log("Device selected:", device.name);

            const server = await device.gatt.connect();
            console.log("Connected to Bluetooth device:", device.name);

            const service = await server.getPrimaryService("0000ffe0-0000-1000-8000-00805f9b34fb");
            characteristic = await service.getCharacteristic("0000ffe1-0000-1000-8000-00805f9b34fb");

            await characteristic.startNotifications();
            console.log("Notifications started");

            characteristic.addEventListener("characteristicvaluechanged", (event) => {
                const value = new TextDecoder().decode(event.target.value);
                processSensorData(value.trim());
            });

            connectedDevice = device;
        }

        statusText.textContent = "CONNECTED";
        statusText.classList.add("status-connected");
        controlSection.style.display = "flex";
    } catch (error) {
        console.error(`${type} connection failed:`, error);
        usbButton.disabled = false;
        bluetoothButton.disabled = false;
        statusText.textContent = "DISCONNECTED";
        statusText.classList.add("status-disconnected");
        controlSection.style.display = "none";
    }
}

async function readSerial(port) {
    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log("Serial port closed.");
                reader.releaseLock();
                handleDisconnect();
                break;
            }
            buffer += decoder.decode(value, { stream: true });

            let lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                processSensorData(line.trim());
            }
        }
    } catch (error) {
        console.error("Error reading from serial port:", error);
        handleDisconnect();
    }
}

function processSensorData(data) {
    if (data.startsWith("POT:")) {
        document.getElementById("potentiometer-value").innerText = data.replace("POT:", "") + "%";
    } else if (data.startsWith("HUM:")) {
        document.getElementById("humidity-value").innerText = data.replace("HUM:", "") + "%";
    } else if (data.startsWith("TEMP:")) {
        document.getElementById("temperature-value").innerText = data.replace("TEMP:", "") + "°C";
    } else if (data.startsWith("COUNT:")) {
        document.getElementById("counter-display").innerText = data.replace("COUNT:", "");
    }
}

// Send Length & Start/Stop Commands
document.getElementById('send-length').addEventListener('click', async () => {
    const lengthValue = document.getElementById("length-input").value;
    const lengthDisplay = document.getElementById("length-display");

    if (!lengthValue || isNaN(lengthValue) || lengthValue <= 0) {
        alert("Please enter a valid length.");
        return;
    }
    sendData(`LENGTH:${lengthValue}`);
    lengthDisplay.innerText = lengthValue;
});

document.getElementById('start-stop').addEventListener('click', async function () {
    let button = document.getElementById('start-stop');
    if (button.innerText === "START") {
        sendData("START");
        button.innerText = "STOP";
        button.classList.remove("start");
        button.classList.add("stop"); 
    } else {
        sendData("STOP");
        button.innerText = "START";
        button.classList.remove("stop");
        button.classList.add("start");
    }
});

async function sendData(command) {
    try {
        if (serialPort) {
            const writer = serialPort.writable.getWriter();
            await writer.write(new TextEncoder().encode(command + "\n"));
            writer.releaseLock();
        } else if (characteristic) {
            await characteristic.writeValue(new TextEncoder().encode(command + "\n"));
        } else {
            console.error("No connection established.");
            alert("No device connected!");
        }
    } catch (error) {
        console.error("Error sending data:", error);
    }
}

function handleDisconnect() {
    const usbButton = document.getElementById("usb");
    const bluetoothButton = document.getElementById("bluetooth");
    const statusText = document.getElementById("connection-status");
    const controlSection = document.querySelector(".control-section");
    
    usbButton.disabled = false;
    bluetoothButton.disabled = false;
    statusText.textContent = "DISCONNECTED";
    statusText.classList.remove("status-connected");
    statusText.classList.add("status-disconnected");
    controlSection.style.display = "none";
    
    connectedDevice = null;
    characteristic = null;
    serialPort = null;
}

// Update Time Display
function updateTime() {
    const now = new Date();
    const formattedTime = now.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });

    document.getElementById("time-display").innerText = formattedTime;
}

updateTime();
setInterval(updateTime, 1000);
