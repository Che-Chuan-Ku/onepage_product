package com.gomoku;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.FILTER_NAME_PROPERTY_NAME;

/**
 * Opt-in L8 calibration harness (2026-07-10 校準輪工具): selects ONLY
 * Boss對弈統計驗證.feature and filters to just the two L8 scenarios, so a
 * single N=200 recalibration iteration costs ~2 minutes instead of the whole
 * cucumber suite's ~12. NOT part of the default build — the surefire config
 * in pom.xml only includes RunCucumberTest/BossAiPolicyTest, so this runs
 * exclusively via {@code mvn test -Dtest=RunL8CalibrationTest}.
 *
 * Why a separate Suite class instead of -Dcucumber.filter.name on the normal
 * run: a command-line cucumber.filter.name system property does NOT propagate
 * into a nested JUnit Platform Suite-engine execution (the Suite is isolated
 * by design; only @ConfigurationParameter on the Suite class itself is
 * honored) — verified empirically this session (filtered runs silently
 * executed nothing).
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/pve/Boss對弈統計驗證.feature")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
    value = "com.gomoku.cucumber, com.gomoku.steps")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
    value = "pretty")
@ConfigurationParameter(key = FILTER_NAME_PROPERTY_NAME,
    value = ".*SKILL_DEMON.*|.*88%-100%.*")
public class RunL8CalibrationTest {
}
