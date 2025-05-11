export enum AppointmentStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
    COMPLETED = 'completed'
}

export interface Appointment {
    id?: number;
    guest_id: number;
    saloon_id: number;
    service_id: number;
    appointment_date: Date;
    status: AppointmentStatus;
    notes?: string;
    created_at?: Date;
    updated_at?: Date;
}

export const appointmentTableQuery = `
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guest_id INT NOT NULL,
  saloon_id INT NOT NULL,
  service_id INT NOT NULL,
  appointment_date DATETIME NOT NULL,
  status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (saloon_id) REFERENCES saloons(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES saloon_services(id) ON DELETE CASCADE
)
`;
