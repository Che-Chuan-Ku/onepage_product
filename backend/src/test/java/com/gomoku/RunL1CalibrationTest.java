package com.gomoku;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.FILTER_NAME_PROPERTY_NAME;

/**
 * Opt-in L1 calibration harness (§7.6 致命骰禁令補償校準輪工具): filters
 * Boss對弈統計驗證.feature to just the two L1 scenarios so one NOVICE-knob
 * iteration costs ~2 minutes instead of the whole 16-scenario matrix. Same
 * opt-in/Suite reasoning as {@link RunL8CalibrationTest}.
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/pve/Boss對弈統計驗證.feature")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
    value = "com.gomoku.cucumber, com.gomoku.steps")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
    value = "pretty")
@ConfigurationParameter(key = FILTER_NAME_PROPERTY_NAME,
    value = ".*第1關.*")
public class RunL1CalibrationTest {
}
