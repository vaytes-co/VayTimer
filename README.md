# VayTimer

Timer sederhana untuk latihan bersama dengan sinkronisasi real-time antar perangkat menggunakan Firebase Realtime Database.

## Fitur

- Durasi 1, 1,5, 2, dan 3 menit
- Mulai, jeda, lanjut, dan reset tersinkron
- Room otomatis dari URL
- Salin link room
- Tampilan responsif

## Konfigurasi Firebase

1. Buat project di Firebase Console.
2. Tambahkan Web App.
3. Aktifkan Realtime Database.
4. Masukkan konfigurasi Web App ke `app.js` pada bagian `firebaseConfig`.
5. Terapkan rules dari `firebase-rules.json`.

> Jangan menggunakan rules database yang membuka seluruh database. Rules pada file ini membatasi akses pada path `rooms/{roomId}`.

## Menjalankan

Karena aplikasi menggunakan JavaScript module, jalankan melalui web server seperti Live Server atau deploy ke GitHub Pages.

Contoh URL room:

`https://username.github.io/vaytimer/?room=AB12CD`

Bagikan URL room yang sama ke perangkat lain untuk menggunakan timer secara sinkron.

## Deploy ke GitHub Pages

1. Upload semua file project ke repository GitHub.
2. Buka **Settings → Pages** pada repository.
3. Pilih **Deploy from a branch**.
4. Pilih branch `main` dan folder `/ (root)`.
5. Simpan dan tunggu proses deployment selesai.
