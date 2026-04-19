package com.onepage.product.repository;

import com.onepage.product.model.Website;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WebsiteRepository extends JpaRepository<Website, Long> {

    List<Website> findByStatus(Website.WebsiteStatus status);

    List<Website> findByOwnerUserId(Long ownerUserId);
}
