import { ShipmentStatus } from '@prisma/client';
import {
  checkTransition,
  getAllowedTransitions,
  isValidTransition,
  nextPreviousStatus,
} from './shipment-status';

const ALL_STATUSES: ShipmentStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'RECEIVED_AT_WAREHOUSE',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'ON_HOLD',
  'CANCELLED',
];

describe('getAllowedTransitions', () => {
  it('menyaring READY_FOR_PICKUP hanya untuk PORT_TO_PORT', () => {
    expect(
      getAllowedTransitions('ARRIVED_AT_DESTINATION', 'PORT_TO_PORT'),
    ).toEqual(['READY_FOR_PICKUP', 'ON_HOLD']);
  });

  it('menyaring OUT_FOR_DELIVERY hanya untuk PORT_TO_DOOR', () => {
    expect(
      getAllowedTransitions('ARRIVED_AT_DESTINATION', 'PORT_TO_DOOR'),
    ).toEqual(['OUT_FOR_DELIVERY', 'ON_HOLD']);
  });

  it('dari ON_HOLD hanya boleh kembali ke status sebelum tertahan atau dibatalkan', () => {
    expect(
      getAllowedTransitions('ON_HOLD', 'PORT_TO_DOOR', 'IN_TRANSIT'),
    ).toEqual(['IN_TRANSIT', 'CANCELLED']);
  });

  it('dari ON_HOLD tanpa previousStatus hanya boleh dibatalkan', () => {
    expect(getAllowedTransitions('ON_HOLD', 'PORT_TO_DOOR', null)).toEqual([
      'CANCELLED',
    ]);
  });

  it('DELIVERED dan CANCELLED bersifat final', () => {
    expect(getAllowedTransitions('DELIVERED', 'PORT_TO_DOOR')).toEqual([]);
    expect(getAllowedTransitions('CANCELLED', 'PORT_TO_DOOR')).toEqual([]);
  });
});

describe('isValidTransition — seluruh jalur sah diterima', () => {
  const validPaths: Array<[ShipmentStatus, ShipmentStatus]> = [
    ['PENDING_PAYMENT', 'PAID'],
    ['PENDING_PAYMENT', 'CANCELLED'],
    ['PAID', 'RECEIVED_AT_WAREHOUSE'],
    ['PAID', 'CANCELLED'],
    ['RECEIVED_AT_WAREHOUSE', 'IN_TRANSIT'],
    ['RECEIVED_AT_WAREHOUSE', 'ON_HOLD'],
    ['RECEIVED_AT_WAREHOUSE', 'CANCELLED'],
    ['IN_TRANSIT', 'ARRIVED_AT_DESTINATION'],
    ['IN_TRANSIT', 'ON_HOLD'],
    ['ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY'],
    ['ARRIVED_AT_DESTINATION', 'ON_HOLD'],
    ['OUT_FOR_DELIVERY', 'DELIVERED'],
    ['OUT_FOR_DELIVERY', 'ON_HOLD'],
  ];

  it.each(validPaths)('%s → %s diterima', (from, to) => {
    expect(isValidTransition(from, to, 'PORT_TO_DOOR')).toBe(true);
  });

  it('READY_FOR_PICKUP → DELIVERED diterima untuk PORT_TO_PORT', () => {
    expect(
      isValidTransition('READY_FOR_PICKUP', 'DELIVERED', 'PORT_TO_PORT'),
    ).toBe(true);
  });
});

describe('isValidTransition — seluruh jalur tidak sah ditolak', () => {
  it('menolak lompatan status', () => {
    expect(
      isValidTransition('PENDING_PAYMENT', 'DELIVERED', 'PORT_TO_DOOR'),
    ).toBe(false);
    expect(isValidTransition('PAID', 'IN_TRANSIT', 'PORT_TO_DOOR')).toBe(false);
    expect(isValidTransition('IN_TRANSIT', 'DELIVERED', 'PORT_TO_DOOR')).toBe(
      false,
    );
  });

  it('menolak mundur ke status sebelumnya', () => {
    expect(isValidTransition('IN_TRANSIT', 'PAID', 'PORT_TO_DOOR')).toBe(false);
  });

  it('menolak READY_FOR_PICKUP untuk PORT_TO_DOOR', () => {
    expect(
      isValidTransition(
        'ARRIVED_AT_DESTINATION',
        'READY_FOR_PICKUP',
        'PORT_TO_DOOR',
      ),
    ).toBe(false);
  });

  it('menolak OUT_FOR_DELIVERY untuk PORT_TO_PORT', () => {
    expect(
      isValidTransition(
        'ARRIVED_AT_DESTINATION',
        'OUT_FOR_DELIVERY',
        'PORT_TO_PORT',
      ),
    ).toBe(false);
  });

  it('menolak keluar dari ON_HOLD ke status selain previousStatus', () => {
    expect(
      isValidTransition('ON_HOLD', 'DELIVERED', 'PORT_TO_DOOR', 'IN_TRANSIT'),
    ).toBe(false);
  });

  it('tidak menerima transisi apa pun dari status final', () => {
    for (const target of ALL_STATUSES) {
      expect(isValidTransition('DELIVERED', target, 'PORT_TO_DOOR')).toBe(
        false,
      );
      expect(isValidTransition('CANCELLED', target, 'PORT_TO_DOOR')).toBe(
        false,
      );
    }
  });
});

describe('checkTransition', () => {
  it('menyebutkan transisi yang diizinkan saat ditolak', () => {
    const message = checkTransition('DELIVERED', {
      status: 'ARRIVED_AT_DESTINATION',
      serviceType: 'PORT_TO_PORT',
    });

    expect(message).toBe(
      'Status tidak dapat diubah ke sana. Yang diizinkan: READY_FOR_PICKUP, ON_HOLD.',
    );
  });

  it('memberi pesan khusus untuk status final', () => {
    expect(
      checkTransition('PAID', {
        status: 'DELIVERED',
        serviceType: 'PORT_TO_DOOR',
      }),
    ).toBe('Kiriman ini sudah berstatus akhir dan tidak dapat diubah lagi.');
  });

  it('mewajibkan deliveredTo saat DELIVERED', () => {
    expect(
      checkTransition('DELIVERED', {
        status: 'OUT_FOR_DELIVERY',
        serviceType: 'PORT_TO_DOOR',
      }),
    ).toBe('Nama penerima barang wajib diisi untuk status Diterima.');

    expect(
      checkTransition('DELIVERED', {
        status: 'OUT_FOR_DELIVERY',
        serviceType: 'PORT_TO_DOOR',
        deliveredTo: 'Dewi Lestari',
      }),
    ).toBeNull();
  });

  it('mewajibkan alasan saat ON_HOLD dan CANCELLED', () => {
    expect(
      checkTransition('ON_HOLD', {
        status: 'IN_TRANSIT',
        serviceType: 'PORT_TO_DOOR',
      }),
    ).toBe('Alasan wajib diisi untuk status ini.');

    expect(
      checkTransition('CANCELLED', {
        status: 'PENDING_PAYMENT',
        serviceType: 'PORT_TO_DOOR',
        reason: '   ',
      }),
    ).toBe('Alasan wajib diisi untuk status ini.');

    expect(
      checkTransition('ON_HOLD', {
        status: 'IN_TRANSIT',
        serviceType: 'PORT_TO_DOOR',
        reason: 'Dokumen belum lengkap',
      }),
    ).toBeNull();
  });

  it('memeriksa keabsahan transisi sebelum kelengkapan field', () => {
    // Transisi tidak sah ke DELIVERED tanpa deliveredTo: yang dilaporkan
    // adalah transisinya, bukan field yang kurang.
    expect(
      checkTransition('DELIVERED', {
        status: 'PENDING_PAYMENT',
        serviceType: 'PORT_TO_DOOR',
      }),
    ).toContain('Yang diizinkan');
  });
});

describe('nextPreviousStatus', () => {
  it('mencatat status sebelum tertahan saat masuk ON_HOLD', () => {
    expect(nextPreviousStatus('IN_TRANSIT', 'ON_HOLD')).toBe('IN_TRANSIT');
  });

  it('mengosongkan penanda saat keluar dari ON_HOLD', () => {
    expect(nextPreviousStatus('ON_HOLD', 'IN_TRANSIT')).toBeNull();
  });

  it('tidak menyentuh penanda pada transisi biasa', () => {
    expect(nextPreviousStatus('PAID', 'RECEIVED_AT_WAREHOUSE')).toBeUndefined();
  });
});
