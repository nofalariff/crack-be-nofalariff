# LogiSend API

REST API untuk LogiSend — layanan kargo Port to Port dan Port to Door.
Dibangun mengikuti [`planbackend.md`](../planbackend.md), menggantikan mock MSW
yang dipakai frontend [`crack-fe-nofalariff`](../crack-fe-nofalariff).

| | |
| --- | --- |
| **Framework** | NestJS 11 di atas Bun |
| **Database** | PostgreSQL + Prisma |
| **Autentikasi** | JWT access + refresh token |
| **Dokumentasi** | Swagger di `/api/docs` |
| **Base URL** | `/api/v1` |

---

## Menjalankan secara lokal

### 1. Prasyarat

- Bun ≥ 1.3
- PostgreSQL berjalan, dan sebuah database kosong (mis. `logisend`)

### 2. Siapkan environment

```bash
cp .env.example .env
```

Sesuaikan `DATABASE_URL`, lalu isi `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET`.
Aplikasi **gagal start** bila ada variabel wajib yang kosong atau tidak valid —
itu disengaja, supaya salah konfigurasi ketahuan saat boot, bukan saat request
pertama.

### 3. Pasang dependensi dan siapkan database

```bash
bun install
bunx prisma migrate deploy   # atau: bun run prisma:migrate
bun run prisma:seed          # data lengkap replika mock frontend
```

### 4. Jalankan

```bash
bun run start:dev
```

- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`
- Health check: `http://localhost:3001/health`

---

## Data contoh

`bun run prisma:seed` mereplikasi `src/mocks/db.ts` milik frontend: 8 rute
beserta tarifnya, 10 akun, 40 kiriman yang tersebar di seluruh status, 4
pembayaran menunggu verifikasi (termasuk satu yang nominal transfernya tidak
sesuai tagihan), 10 kiriman yang sengaja mandek, dan 2 kiriman `ON_HOLD`.

Tujuannya bukan sekadar kemiripan: dengan data ini, 58 pengujian E2E frontend
bisa dijalankan ulang terhadap backend asli tanpa mengubah satu pun asersinya.
Nomor resi milik `budi@example.com` dan `agen@example.com` dipakai sebagai
asersi di sana — jangan diubah.

```bash
bun run prisma:seed          # data lengkap untuk pengembangan dan demo
bun run prisma:seed:minimal  # hanya admin + rute + tarif, untuk production
```

### Akun uji

Seluruh akun contoh memakai kata sandi **`password123`**.

| Peran | Email | Catatan |
| --- | --- | --- |
| Admin | dari `ADMIN_EMAIL` | kata sandi dari `ADMIN_PASSWORD` |
| Customer | `budi@example.com` | dipakai E2E frontend — jangan ubah kirimannya |
| Agen disetujui | `agen@example.com` | dipakai E2E frontend |
| Agen menunggu | `agenbaru@example.com` | harus tetap `PENDING` |
| Customer | `dewi@example.com`, `rahmat@example.com` | data operasional |
| Customer ditangguhkan | `nonaktif@example.com` | untuk menguji blokir login |
| Agen disetujui | `kargo@example.com` | data operasional |
| Agen menunggu | `agenkedua@example.com` | untuk menguji approval |
| Agen ditolak | `agenditolak@example.com` | untuk menguji tampilan alasan penolakan |

> Admin sengaja tidak ikut di data mock: kredensialnya diambil dari environment
> variable (PRD §4.2 — akun admin dibuat lewat seed, bukan registrasi publik).
> Agar sama persis dengan mock frontend, set `ADMIN_PASSWORD=password123`.

---

## Pengujian

```bash
bun run lint && bun run typecheck
bun run test        # unit — tarif, nomor resi, state machine
bun run test:e2e    # E2E terhadap database sungguhan
```

E2E memakai database yang sama dengan pengembangan. Setiap suite membuat
datanya sendiri dengan email dan kode tujuan berakhiran unik, lalu
membersihkannya kembali, sehingga aman dijalankan berdampingan dengan data
seed.

---

## Arsitektur

```
src/
├── common/          # decorator, guard, filter, interceptor, util, DTO bersama
├── prisma/          # PrismaService
├── storage/         # StorageService (driver local; ruang untuk s3)
├── auth/            # registrasi, login, refresh, profil
├── users/           # buku alamat + kelola user (admin)
├── agents/          # approval agen
├── routes/          # master rute + tarif
├── rates/           # kalkulator ongkir
├── shipments/       # booking, daftar, status, koreksi berat, label, manifest
├── payments/        # invoice, bukti bayar, verifikasi
├── files/           # penyajian berkas terautentikasi
├── dashboard/       # ringkasan customer & admin
└── audit/           # pencatatan & riwayat aksi admin
```

Tiga aturan yang menjaga lapisannya tetap rapi:

1. **Kata `prisma` hanya muncul di `*.repository.ts` dan `PrismaService`.**
   Bila muncul di service atau controller, lapisannya bocor.
2. **Seluruh aturan bisnis ada di service.** Controller hanya menerima DTO,
   memanggil service, dan menentukan status HTTP.
3. **Kepemilikan diperiksa di service, bukan hanya lewat role.** Kiriman milik
   orang lain dibalas `404`, bukan `403`, supaya keberadaan datanya tidak
   terbaca.

### Hal yang mudah terlewat

- **Nominal uang disimpan sebagai `BigInt`**, tidak pernah dihitung dengan
  floating point. Konversi ke `number` hanya terjadi di pemetaan response.
- **Tarif di-snapshot ke kiriman** saat booking (`pricePerKgSnapshot`,
  `baseFeeSnapshot`, `minChargeableWeightSnapshot`). Mengubah tarif rute tidak
  pernah mengubah tagihan yang sudah terbit — termasuk saat berat dikoreksi.
- **`shipment_events` bersifat append-only.** Koreksi dilakukan dengan menambah
  event baru, bukan mengubah yang lama.
- **Tipe berkas unggahan diperiksa lewat magic number**, bukan ekstensi atau
  `Content-Type` dari klien. Nama berkas di disk selalu UUID acak.
- **Setiap aksi admin yang mengubah keadaan menulis satu baris audit**, dalam
  transaksi yang sama dengan aksinya.

---

## Deployment

| Lingkungan | Backend | Database |
| --- | --- | --- |
| Development | `bun run start:dev` | PostgreSQL lokal / Docker |
| Production | Railway (`railway.json`) | Supabase Postgres + Supabase Storage |

`bun run start:prod` menjalankan `prisma migrate deploy` lebih dulu, sehingga
migrasi ikut jalan setiap deploy. Panduan langkah demi langkah ada di
`DEPLOYMENT.md` pada folder induk proyek.

Untuk production:

- `DATABASE_URL` memakai pooler Supabase (port 6543, `?pgbouncer=true&connection_limit=1`);
  `DIRECT_URL` memakai session pooler (port 5432) untuk migrasi.
- `STORAGE_DRIVER=s3` + kredensial S3 Supabase Storage — disk server Railway
  terhapus setiap redeploy.
- Swagger mati secara bawaan; jangan set `SWAGGER_ENABLED=true`.
- Isi `CORS_ORIGINS` dengan origin frontend yang sebenarnya.
- Seed sekali saja dengan `bun run prisma:seed:minimal`. Di `NODE_ENV=production`
  seed menolak berjalan bila database sudah berisi akun, atau tanpa `--minimal`.
- Gunakan secret JWT yang panjang dan acak, berbeda antara access dan refresh.

### Variabel environment

Seluruhnya divalidasi saat boot; lihat [`.env.example`](.env.example) untuk
daftar lengkap beserta contoh nilainya.

---

## Integrasi dengan frontend

Tipe TypeScript frontend dapat di-generate ulang dari Swagger, sehingga
perbedaan bentuk response langsung muncul sebagai error TypeScript
(NFR-MNT-05):

```bash
# dari repo frontend, dengan backend berjalan
bunx openapi-typescript http://localhost:3001/api/docs-json -o src/types/api.ts
```

Lalu arahkan frontend ke backend asli di `crack-fe-nofalariff/.env.local`:

```
API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_API_MOCKING=disabled
```
