package com.onepage.product.repository;

import com.onepage.product.model.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

    Optional<Invoice> findByOrderId(Long orderId);

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
}
