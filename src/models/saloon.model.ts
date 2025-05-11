export interface Saloon {
    id?: number;
    name: string;
    description?: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    owner_id: number;
    opening_time?: string; // Format: HH:MM (24-hour)
    closing_time?: string; // Format: HH:MM (24-hour)
    created_at?: Date;
    updated_at?: Date;
}

export interface SaloonService {
    id?: number;
    saloon_id: number;
    name: string;
    description?: string;
    price: number;
    duration?: number; // in minutes
    created_at?: Date;
    updated_at?: Date;
}

export const saloonTableQuery = `
CREATE TABLE IF NOT EXISTS saloons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  owner_id INT NOT NULL,
  opening_time TIME DEFAULT '09:00:00',
  closing_time TIME DEFAULT '17:00:00',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

export const saloonServiceTableQuery = `
CREATE TABLE IF NOT EXISTS saloon_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  saloon_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (saloon_id) REFERENCES saloons(id) ON DELETE CASCADE
)
`;
