package com.gomoku;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/**
 * Opt-in fast harness for just 魔王對弈.feature (§7.6 第二批 polish de-risk):
 * exercises the new L6 edge-wave / L5 rock-count / L3 void / L8 skill cases
 * without paying for the N=200 statistics matrix. NOT part of the default
 * build; run via {@code mvn test -Dtest=RunBossDuelFeatureTest}.
 */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/pve/魔王對弈.feature")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
    value = "com.gomoku.cucumber, com.gomoku.steps")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
    value = "pretty")
public class RunBossDuelFeatureTest {
}
