// models/deviceModel.js
const db = require('./db');

const createDevice = (device_id, device_name, topic_name, status, created_by) => {
    return new Promise((resolve, reject) => {
        const query = 'INSERT INTO devices (device_id, device_name, topic_name, status, created_by) VALUES (?, ?, ?, ?, ?)';
        db.query(query, [device_id, device_name, topic_name, status, created_by], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const getAllDevices = (superadminId) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM devices WHERE created_by = ?';
        db.query(query, [superadminId], (err, results) => {
            if (err) reject(err);
            resolve(results);
        });
    });
};

const getDeviceById = (device_id, superadminId) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM devices WHERE device_id = ? AND created_by = ?';
        db.query(query, [device_id, superadminId], (err, results) => {
            if (err) reject(err);
            resolve(results[0]);
        });
    });
};



const updateDevice = (device_id, device_name, topic_name, status, superadminId) => {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE devices SET device_name = ?, topic_name = ?, status = ? WHERE device_id = ? AND created_by = ?';
        db.query(query, [device_name, topic_name, status, device_id, superadminId], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const deleteDevice = (device_id, superadminId) => {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM devices WHERE device_id = ? AND created_by = ?';
        db.query(query, [device_id, superadminId], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const getActiveDevices = (superadminId) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM devices WHERE created_by = ? AND status = "active"';
        db.query(query, [superadminId], (err, results) => {
            if (err) reject(err);
            resolve(results);
        });
    });
};

const assignDeviceToCollection = (device_id, collection_id) => {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE devices SET collection_id = ? WHERE device_id = ? AND collection_id IS NULL';
        db.query(query, [collection_id, device_id], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const removeDeviceFromCollection = (device_id) => {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE devices SET collection_id = NULL WHERE device_id = ?';
        db.query(query, [device_id], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const getDeviceByIdcol = (device_id) => {
    // console.log("Looking for device:", device_id); // Add this
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM devices WHERE device_id = ?', [device_id], (err, results) => {
            if (err) reject(err);
            resolve(results[0]);
        });
    });
};








module.exports = {
    createDevice,
    getAllDevices,
    getDeviceById,
    updateDevice,
    deleteDevice,
    getActiveDevices,
    assignDeviceToCollection,
    removeDeviceFromCollection,
    getDeviceByIdcol
  
};
