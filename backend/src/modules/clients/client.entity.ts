/** Objetivo: mapeo ORM de la tabla `clients`. */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'clients' })
export class ClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ name: 'document_id', type: 'varchar', length: 20, nullable: true })
  documentId: string | null;

  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  address: string | null;

  /** Fecha de ingreso del cliente (dato de negocio, YYYY-MM-DD). */
  @Column({ name: 'registered_at', type: 'date' })
  registeredAt: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
