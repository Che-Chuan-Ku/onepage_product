package com.gomoku;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/**
 * Opt-in full-matrix duel-statistics harness (§7.6 2026-07-10 第二批 polish
 * 校準輪工具): selects ONLY Boss對弈統計驗證.feature — all 16 N=200 scenarios
 * (8 levels x reference/ordinary player) — so a matrix recalibration doesn't
 * pay for the rest of the cucumber suite. NOT part of the default build (the
 * surefire include list only picks up RunCucumberTest + the pure unit tests);
 * runs exclusively via {@code mvn test -Dtest=RunDuelStatsTest}. Same
 * Suite-class-instead-of-cucumber.filter.name reasoning as
 * {@link RunL8CalibrationTest} (a -D filter does not propagate into a nested
 * Suite-engine execution).
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/pve/Boss對弈統計驗證.feature")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
    value = "com.gomoku.cucumber, com.gomoku.steps")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
    value = "pretty")
public class RunDuelStatsTest {
}
