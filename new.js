const { exec } = require('child_process');

// Example data that you want to pass to the Python script
const data = {
    country: "Iran",
    countryPercentage: 45,
    brandCategory: "Shows",
    brandName: "Lotus Herbals",
    cities: ["Tehran", "Mashhad", "Isfahan", "Shiraz", "Tabriz"]
};

// Convert the JavaScript object to a JSON string
const jsonData = JSON.stringify(data);

// Prepare the command to run the Python script
const command = `python predict.py "${jsonData.replace(/"/g, '\\"')}"`;

console.log("Running command:", command);

// Run the Python script
exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error executing Python script: ${error.message}`);
        return;
    }

    if (stderr) {
        console.error(`Python script error: ${stderr}`);
        return;
    }

    console.log(`Python script output: ${stdout}`);
});
