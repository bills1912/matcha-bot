import axios from 'axios';
import config from './config.js';

export class SheetsReader {
    constructor(spreadsheetId) {
        this.spreadsheetId = spreadsheetId || config.googleSheetId;
    }

    async readSheet(sheetName, startRow, maxRows) {
        try {
            console.log(`📊 Reading sheet: ${sheetName}`);

            const url = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

            const response = await axios.get(url);
            const jsonString = response.data.substring(47).slice(0, -2);
            const data = JSON.parse(jsonString);

            const rows = data.table.rows;
            console.log(`✅ Total rows in sheet: ${rows.length}`);

            // HARDCODE headers karena tidak ada di sheet
            const headers = [
                'idsbr',           // Kolom B
                'nama_usaha',      // Kolom C
                'nama_komersial_usaha', // Kolom C tambahan
                'cek',
                'alamat',          // Kolom E
                'nama_sls',
                'kodepos',
                'nomor_telepon',
                'nomor_whatsapp',
                'email',
                'website',
                'latitude',        // Kolom G
                'longitude',       // Kolom H
                'keberadaan_usaha'
            ];

            console.log('📋 Using hardcoded headers:', headers);

            const result = [];
            const endRow = Math.min(startRow + maxRows - 1, rows.length);

            for (let i = startRow - 1; i < endRow; i++) {
                const row = rows[i];
                if (!row || !row.c) continue;

                const rowData = {};
                headers.forEach((header, index) => {
                    const cell = row.c[index];
                    rowData[header] = cell ? cell.v : null;
                });

                result.push({
                    rowNumber: i + 1,
                    data: rowData
                });
            }

            console.log(`✅ Read ${result.length} rows`);
            return result;

        } catch (error) {
            throw new Error(`Error reading sheet: ${error.message}`);
        }
    }
}