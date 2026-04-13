package com.classpulse.domain.invite;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RegistrationCodeRepository extends JpaRepository<RegistrationCode, Long> {
    Optional<RegistrationCode> findByCode(String code);
    List<RegistrationCode> findByCreatedByIdOrderByCreatedAtDesc(Long createdById);

    @Query("SELECT rc FROM RegistrationCode rc LEFT JOIN FETCH rc.createdBy LEFT JOIN FETCH rc.usedBy ORDER BY rc.createdAt DESC")
    List<RegistrationCode> findAllByOrderByCreatedAtDesc();
}
