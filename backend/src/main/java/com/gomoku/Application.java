package com.gomoku;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling powers RoomService#sweepExpiredRooms (bug fix: stale
// WAITING/FINISHED rooms used to never get cleaned up — see RoomService TTL constants).
@EnableScheduling
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
